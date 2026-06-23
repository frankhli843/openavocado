/**
 * Serve gitignored runtime artifacts (generated lesson audio, etc.).
 *
 * `generated_artifacts.file_path` is stored relative to the project root
 * (`runtime_artifacts/audio/lesson_4_audio.mp3`), and the lesson UI requests it
 * at `/runtime/<file_path>`. This handler resolves that path safely (refusing
 * any traversal outside `runtime_artifacts/`), streams the file with the right
 * content type, and supports HTTP Range requests so the <audio> player can seek.
 */
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/db/connection";
import { resolveRuntimeSegments } from "@/lib/audio/runtime-storage";
import { synthesizeSpeech } from "@/lib/audio/tts";

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};

function contentTypeFor(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  const ext = dot >= 0 ? filePath.slice(dot).toLowerCase() : "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const abs = resolveRuntimeSegments(segments ?? []);
  if (!abs) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  // Self-heal: if the file is missing but a generated_artifacts row references
  // this exact path and carries the source script, synthesize it on demand so
  // the audio player always gets a real, playable file (HTTP 200) even on a
  // freshly-seeded deployment where `pnpm audio:generate` has not been run yet.
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    const healed = await tryLazyGenerate(segments ?? [], abs);
    if (!healed) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  const stat = fs.statSync(abs);
  const total = stat.size;
  const contentType = contentTypeFor(abs);
  const range = req.headers.get("range");

  // Range request → 206 Partial Content (lets the audio player seek/scrub).
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunk = fs.readFileSync(abs).subarray(start, end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  const body = fs.readFileSync(abs);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/**
 * Generate a missing audio artifact on demand from its recorded source script.
 * Returns true if the file now exists. Best-effort: any failure returns false
 * so the caller serves a 404 instead of throwing.
 */
async function tryLazyGenerate(segments: string[], absPath: string): Promise<boolean> {
  try {
    const relPath = segments.join("/");
    const db = getDb();
    const artifact = db
      .prepare(
        `SELECT lesson_id, source_script FROM generated_artifacts
         WHERE file_path = ? AND artifact_type = 'audio'
         ORDER BY generated_at DESC LIMIT 1`
      )
      .get(relPath) as
      | { lesson_id: number | null; source_script: string | null }
      | undefined;
    if (!artifact) return false;

    // Prefer the authoritative full script from the lesson's audio activity;
    // fall back to the artifact's recorded source_script.
    let script = (artifact.source_script ?? "").trim();
    if (artifact.lesson_id != null) {
      const activity = db
        .prepare(
          `SELECT content FROM lesson_activities
           WHERE lesson_id = ? AND activity_type = 'audio'
           ORDER BY sequence_order ASC LIMIT 1`
        )
        .get(artifact.lesson_id) as { content: string | null } | undefined;
      if (activity?.content) {
        try {
          const parsed = JSON.parse(activity.content);
          if (parsed?.script && String(parsed.script).trim()) {
            script = String(parsed.script).trim();
          }
        } catch {
          /* keep artifact fallback */
        }
      }
    }
    if (!script) return false;

    await synthesizeSpeech(script, { outPath: absPath });
    return fs.existsSync(absPath) && fs.statSync(absPath).size > 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[runtime] lazy audio generation failed: ${(err as Error).message}`);
    return false;
  }
}
