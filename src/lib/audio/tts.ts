/**
 * Text-to-speech adapter for lesson audio.
 *
 * The lesson generator and the live-data backfill both need to turn a lesson's
 * audio script into a real, playable MP3 file. This module is the single clean
 * boundary for that. It tries providers in order and falls back gracefully so a
 * deployment always ends up with a real audio file rather than placeholder
 * metadata that points at a 404:
 *
 *   1. Doraemon edge TTS — default learner-facing narration voice.
 *   2. OpenAI TTS       — optional fallback when OPENAI_API_KEY has quota.
 *   3. espeak-ng        — last-resort offline fallback, never preferred for
 *                         generated lesson narration.
 *
 * Server-only: uses Node fs / child_process. Never import from client code.
 */
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export type TtsProvider = "doraemon-edge-tts" | "openai-tts" | "espeak-ng";

export interface TtsResult {
  /** Absolute path to the written MP3 file. */
  filePath: string;
  /** Provider that actually produced the audio. */
  provider: TtsProvider;
  /** Voice identifier used. */
  voice: string;
  /** Duration of the rendered audio in seconds. */
  durationSec: number;
  /** SHA-256 of the rendered file, as `sha256:<hex>`. */
  contentHash: string;
  /** Bytes written. */
  bytes: number;
}

export interface TtsOptions {
  /** Absolute output path for the MP3. Parent dirs are created. */
  outPath: string;
  /** Preferred voice (provider-specific; mapped per provider). */
  voice?: string;
  /** Force a specific provider (skips fallback). Mainly for tests. */
  provider?: TtsProvider;
  /** Words-per-minute pacing for the espeak fallback. */
  espeakWpm?: number;
}

interface DialogueSegment {
  speaker: "male" | "female";
  text: string;
}

const SPEAKER_LABEL_RE =
  /(?:\*\*)?(Leo|Male host|Host A|Doraemon|Daniel|Alex|Maya|Female host|Host B|Guest|Ava|Mina)(?:\*\*)?\s*:\s*/gi;

function sha256File(p: string): string {
  const buf = fs.readFileSync(p);
  return "sha256:" + createHash("sha256").update(buf).digest("hex");
}

export function parseDialogueSegments(script: string): DialogueSegment[] {
  const segments: DialogueSegment[] = [];
  const matches = Array.from(script.matchAll(SPEAKER_LABEL_RE));
  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const label = String(match[1] ?? "").toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[i + 1]?.index ?? script.length;
    const text = script.slice(start, end).replace(/\s+/g, " ").trim();
    if (!text) continue;
    segments.push({
      speaker:
        label.includes("maya") ||
        label.includes("female") ||
        label.includes("host b") ||
        label.includes("guest") ||
        label.includes("ava") ||
        label.includes("mina")
          ? "female"
          : "male",
      text,
    });
  }

  return segments.length >= 4 && new Set(segments.map((s) => s.speaker)).size >= 2 ? segments : [];
}

/** Probe MP3 duration in seconds via ffprobe; returns 0 if unavailable. */
function probeDurationSec(p: string): number {
  const r = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      p,
    ],
    { encoding: "utf-8" }
  );
  const v = parseFloat((r.stdout || "").trim());
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function synthesizeDoraemonEdgeDialogue(
  script: string,
  outPath: string,
  maleVoice: string,
  femaleVoice: string
): TtsResult | null {
  const segments = parseDialogueSegments(script);
  if (!segments.length) return null;
  ensureDir(outPath);
  const digest = createHash("sha256").update(script).digest("hex").slice(0, 16);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `avo-dialogue-tts-${digest}-`));
  const listPath = path.join(tmpDir, "concat.txt");
  try {
    const segmentPaths: string[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const segmentPath = path.join(tmpDir, `segment-${String(i).padStart(3, "0")}.mp3`);
      synthesizeDoraemonEdge(
        segment.text,
        segmentPath,
        segment.speaker === "female" ? femaleVoice : maleVoice
      );
      segmentPaths.push(segmentPath);
    }
    fs.writeFileSync(
      listPath,
      segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`).join("\n")
    );
    const ff = spawnSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
    );
    if (ff.status !== 0) {
      throw new Error(`ffmpeg dialogue concat failed (status ${ff.status}): ${ff.stderr?.toString() ?? ""}`);
    }
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1024) {
      throw new Error("dialogue edge_tts produced an empty or suspiciously small audio file");
    }
    const durationSec = probeDurationSec(outPath);
    const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
    const expectedMinSec = Math.max(1, wordCount * 0.12);
    if (durationSec > 0 && durationSec < expectedMinSec) {
      throw new Error(`dialogue edge_tts output is too short (${durationSec}s for ${wordCount} words)`);
    }
    return {
      filePath: outPath,
      provider: "doraemon-edge-tts",
      voice: `${maleVoice}+${femaleVoice}`,
      durationSec,
      contentHash: sha256File(outPath),
      bytes: fs.statSync(outPath).size,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Learner-facing default narration via edge_tts. This matches the workspace's
 * Doraemon voice path without depending on OpenAI quota. It uses python's
 * edge_tts package and writes MP3 directly, then validates duration and size so
 * a partial output never gets recorded as a valid lesson artifact.
 */
function synthesizeDoraemonEdge(script: string, outPath: string, voice: string): TtsResult {
  ensureDir(outPath);
  const textPath = path.join(
    os.tmpdir(),
    `avo-edge-tts-${createHash("sha256").update(script).digest("hex").slice(0, 16)}.txt`
  );
  fs.writeFileSync(textPath, script);

  const py = spawnSync(
    "python3",
    [
      "-",
      textPath,
      voice,
      outPath,
    ],
    {
      input: `
import asyncio
import sys
import edge_tts

text_path, voice, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(text_path, "r", encoding="utf-8") as f:
    text = f.read()

async def run():
    communicate = edge_tts.Communicate(text, voice, rate="+5%")
    await communicate.save(out_path)

asyncio.run(run())
`,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  try {
    fs.unlinkSync(textPath);
  } catch {
    /* best effort */
  }
  if (py.status !== 0) {
    throw new Error(
      `edge_tts failed (status ${py.status}): ${py.stderr?.toString() ?? ""}`
    );
  }
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1024) {
    throw new Error("edge_tts produced an empty or suspiciously small audio file");
  }

  const durationSec = probeDurationSec(outPath);
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const expectedMinSec = Math.max(1, wordCount * 0.12);
  if (durationSec > 0 && durationSec < expectedMinSec) {
    throw new Error(
      `edge_tts output is too short (${durationSec}s for ${wordCount} words)`
    );
  }

  return {
    filePath: outPath,
    provider: "doraemon-edge-tts",
    voice,
    durationSec,
    contentHash: sha256File(outPath),
    bytes: fs.statSync(outPath).size,
  };
}

/**
 * Offline TTS via espeak-ng + ffmpeg. Produces a real, playable MP3.
 * Throws if either binary is missing or synthesis fails.
 */
function synthesizeEspeak(
  script: string,
  outPath: string,
  voice: string,
  wpm: number
): TtsResult {
  ensureDir(outPath);
  const wavPath = path.join(
    os.tmpdir(),
    `avo-tts-${createHash("sha256").update(script).digest("hex").slice(0, 16)}.wav`
  );

  // espeak-ng → WAV. en-us is the closest match to the OpenAI "alloy" register.
  const espeak = spawnSync(
    "espeak-ng",
    ["-v", "en-us", "-s", String(wpm), "-w", wavPath, script],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
  );
  if (espeak.status !== 0) {
    throw new Error(
      `espeak-ng failed (status ${espeak.status}): ${espeak.stderr?.toString() ?? ""}`
    );
  }

  // WAV → MP3 via ffmpeg (libmp3lame, 96 kbps mono — plenty for speech).
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "96k", outPath],
    { encoding: "buffer" }
  );
  try {
    fs.unlinkSync(wavPath);
  } catch {
    /* best effort */
  }
  if (ff.status !== 0) {
    throw new Error(
      `ffmpeg failed (status ${ff.status}): ${ff.stderr?.toString() ?? ""}`
    );
  }
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    throw new Error("espeak-ng produced an empty audio file");
  }

  return {
    filePath: outPath,
    provider: "espeak-ng",
    voice,
    durationSec: probeDurationSec(outPath),
    contentHash: sha256File(outPath),
    bytes: fs.statSync(outPath).size,
  };
}

/**
 * OpenAI TTS via the REST API. Throws on any non-200 (e.g. 429 quota) so the
 * caller can fall back. Uses global fetch (Node 18+).
 */
async function synthesizeOpenAI(
  script: string,
  outPath: string,
  voice: string
): Promise<TtsResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input: script,
      response_format: "mp3",
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenAI TTS HTTP ${resp.status}: ${detail.slice(0, 200)}`);
  }
  const arrayBuf = await resp.arrayBuffer();
  ensureDir(outPath);
  fs.writeFileSync(outPath, Buffer.from(arrayBuf));
  if (fs.statSync(outPath).size === 0) {
    throw new Error("OpenAI TTS returned an empty body");
  }

  return {
    filePath: outPath,
    provider: "openai-tts",
    voice,
    durationSec: probeDurationSec(outPath),
    contentHash: sha256File(outPath),
    bytes: fs.statSync(outPath).size,
  };
}

/** Returns true when espeak-ng is callable on this host. */
export function espeakAvailable(): boolean {
  const r = spawnSync("espeak-ng", ["--version"], { encoding: "utf-8" });
  return r.status === 0;
}

/** Returns true when python edge_tts is importable on this host. */
export function doraemonEdgeAvailable(): boolean {
  const r = spawnSync(
    "python3",
    ["-c", "import edge_tts"],
    { encoding: "utf-8" }
  );
  return r.status === 0;
}

/**
 * Synthesize `script` to a real MP3 at `opts.outPath`.
 *
 * Provider order: Doraemon edge TTS → OpenAI TTS (if key + quota) →
 * espeak-ng last-resort offline fallback.
 * Set `opts.provider` to force one provider (used by tests).
 */
export async function synthesizeSpeech(
  script: string,
  opts: TtsOptions
): Promise<TtsResult> {
  const trimmed = (script || "").trim();
  if (!trimmed) throw new Error("synthesizeSpeech: empty script");

  const wantDoraemon = opts.provider === "doraemon-edge-tts";
  const wantOpenAI = opts.provider === "openai-tts";
  const wantEspeak = opts.provider === "espeak-ng";
  const doraemonVoice = opts.voice ?? "en-US-BrianNeural";
  const femalePodcastVoice = "en-US-AvaNeural";
  const openaiVoice = opts.voice ?? "alloy";
  const espeakVoice = opts.voice ?? "en-us";
  const wpm = opts.espeakWpm ?? 165;

  // Forced provider (tests / explicit selection).
  if (wantDoraemon) {
    return synthesizeDoraemonEdgeDialogue(trimmed, opts.outPath, doraemonVoice, femalePodcastVoice)
      ?? synthesizeDoraemonEdge(trimmed, opts.outPath, doraemonVoice);
  }
  if (wantEspeak) return synthesizeEspeak(trimmed, opts.outPath, espeakVoice, wpm);
  if (wantOpenAI) return synthesizeOpenAI(trimmed, opts.outPath, openaiVoice);

  // Default cascade: use the learner-facing Doraemon voice first.
  try {
    return synthesizeDoraemonEdgeDialogue(trimmed, opts.outPath, doraemonVoice, femalePodcastVoice)
      ?? synthesizeDoraemonEdge(trimmed, opts.outPath, doraemonVoice);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[tts] Doraemon edge TTS unavailable, trying fallback providers: ${
        (err as Error).message
      }`
    );
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await synthesizeOpenAI(trimmed, opts.outPath, openaiVoice);
    } catch (err) {
      // Quota exhausted / network / auth — fall through to offline synthesis.
      // eslint-disable-next-line no-console
      console.warn(
        `[tts] OpenAI TTS unavailable, falling back to espeak-ng: ${
          (err as Error).message
        }`
      );
    }
  }
  return synthesizeEspeak(trimmed, opts.outPath, espeakVoice, wpm);
}
