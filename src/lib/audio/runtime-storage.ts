/**
 * Resolution + safety for gitignored runtime artifact storage (generated audio,
 * etc.). `generated_artifacts.file_path` is stored relative to the project root,
 * e.g. `runtime_artifacts/audio/lesson_4_audio.mp3`. Both the audio generator
 * and the `/runtime/[...path]` serving route resolve through this module so the
 * write path and the read path can never drift apart.
 */
import path from "path";

/** Root under which all runtime artifacts live (absolute). */
export function runtimeRoot(): string {
  const configured = process.env.AVOCADOCORE_RUNTIME_ROOT?.trim();
  if (configured) {
    return path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), "runtime_artifacts");
}

/**
 * Resolve a stored `file_path` (relative to project root, must live under
 * `runtime_artifacts/`) to an absolute path, refusing anything that escapes the
 * runtime root via `..` or absolute components. Returns null if the path is
 * unsafe.
 */
export function resolveRuntimeFile(relFromProjectRoot: string): string | null {
  if (!relFromProjectRoot) return null;
  // Normalise and strip any leading slash so it is treated as relative.
  const cleaned = relFromProjectRoot.replace(/^[/\\]+/, "");
  if (cleaned === "runtime_artifacts") return runtimeRoot();
  const prefix = "runtime_artifacts/";
  if (!cleaned.startsWith(prefix)) return null;

  const abs = path.resolve(runtimeRoot(), cleaned.slice(prefix.length));
  const root = runtimeRoot();
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return null;
  }
  return abs;
}

/**
 * Resolve the path segments captured by the `/runtime/[...path]` route. The
 * stored file_path begins with `runtime_artifacts/`, so the served URL is
 * `/runtime/runtime_artifacts/audio/lesson_4_audio.mp3` and segments are
 * `["runtime_artifacts","audio","lesson_4_audio.mp3"]`.
 */
export function resolveRuntimeSegments(segments: string[]): string | null {
  if (!segments || segments.length === 0) return null;
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null;
  return resolveRuntimeFile(segments.join("/"));
}

/** Canonical stored file_path for a lesson's audio artifact. */
export function lessonAudioRelPath(lessonId: number): string {
  return `runtime_artifacts/audio/lesson_${lessonId}_audio.mp3`;
}

/** Canonical stored file_path for an activity-specific audio clip. */
export function activityAudioRelPath(lessonId: number, activityId: number): string {
  return `runtime_artifacts/audio/lesson_${lessonId}_activity_${activityId}_audio.mp3`;
}
