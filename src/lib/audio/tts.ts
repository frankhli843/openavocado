/**
 * Text-to-speech adapter for lesson audio.
 *
 * The lesson generator and the live-data backfill both need to turn a lesson's
 * audio script into a real, playable MP3 file. This module is the single clean
 * boundary for that. It tries providers in order and falls back gracefully so a
 * deployment always ends up with a real audio file rather than placeholder
 * metadata that points at a 404:
 *
 *   1. OpenAI TTS  — used when OPENAI_API_KEY is set and the account has quota.
 *   2. espeak-ng   — fully offline local synthesis (apt: espeak-ng), piped
 *                    through ffmpeg to MP3. Always available on the demo host
 *                    and requires no network or API quota.
 *
 * Server-only: uses Node fs / child_process. Never import from client code.
 */
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export interface TtsResult {
  /** Absolute path to the written MP3 file. */
  filePath: string;
  /** Provider that actually produced the audio. */
  provider: "openai-tts" | "espeak-ng";
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
  provider?: "openai-tts" | "espeak-ng";
  /** Words-per-minute pacing for the espeak fallback. */
  espeakWpm?: number;
}

function sha256File(p: string): string {
  const buf = fs.readFileSync(p);
  return "sha256:" + createHash("sha256").update(buf).digest("hex");
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

/**
 * Synthesize `script` to a real MP3 at `opts.outPath`.
 *
 * Provider order: OpenAI TTS (if key + quota) → espeak-ng offline fallback.
 * Set `opts.provider` to force one provider (used by tests).
 */
export async function synthesizeSpeech(
  script: string,
  opts: TtsOptions
): Promise<TtsResult> {
  const trimmed = (script || "").trim();
  if (!trimmed) throw new Error("synthesizeSpeech: empty script");

  const wantOpenAI = opts.provider === "openai-tts";
  const wantEspeak = opts.provider === "espeak-ng";
  const openaiVoice = opts.voice ?? "alloy";
  const espeakVoice = opts.voice ?? "en-us";
  const wpm = opts.espeakWpm ?? 165;

  // Forced provider (tests / explicit selection).
  if (wantEspeak) return synthesizeEspeak(trimmed, opts.outPath, espeakVoice, wpm);
  if (wantOpenAI) return synthesizeOpenAI(trimmed, opts.outPath, openaiVoice);

  // Default cascade: prefer OpenAI, fall back to offline espeak-ng.
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
