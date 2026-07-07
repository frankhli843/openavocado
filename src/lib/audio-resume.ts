const AUDIO_RESUME_PREFIX = "avocadocore.audioResume.v1";

export function audioResumeKey(activityId: number, filePath?: string | null): string {
  return `${AUDIO_RESUME_PREFIX}:${activityId}:${filePath ?? "no-artifact"}`;
}

export function readAudioResumeTime(storage: Storage, key: string, duration: number): number {
  try {
    const raw = storage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { seconds?: unknown };
    const seconds = typeof parsed.seconds === "number" ? parsed.seconds : 0;
    if (!Number.isFinite(seconds) || seconds < 2) return 0;
    if (duration > 0 && seconds >= duration - 3) return 0;
    return seconds;
  } catch {
    return 0;
  }
}

export function writeAudioResumeTime(storage: Storage, key: string, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  storage.setItem(
    key,
    JSON.stringify({
      seconds,
      savedAt: new Date().toISOString(),
    })
  );
}

export function clearAudioResumeTime(storage: Storage, key: string): void {
  storage.removeItem(key);
}
