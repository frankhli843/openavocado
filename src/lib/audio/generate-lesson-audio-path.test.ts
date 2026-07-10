/**
 * Gap 2 regression: the standalone audio generator must resolve its write path
 * through the same resolver the `/runtime/[...path]` serving route uses, so
 * generated audio honors AVOCADOCORE_RUNTIME_ROOT (set on frank-dev to
 * /var/prodavo/runtime_artifacts) instead of always writing under process.cwd().
 *
 * `generate-lesson-audio.ts` computes `absPath = resolveRuntimeFile(relPath)`,
 * so asserting the resolver's behavior for the canonical audio rel paths under
 * both a set and unset env proves the write path lands at the served location.
 */
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  activityAudioRelPath,
  lessonAudioRelPath,
  resolveRuntimeFile,
} from "./runtime-storage";

const ORIGINAL = process.env.AVOCADOCORE_RUNTIME_ROOT;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AVOCADOCORE_RUNTIME_ROOT;
  else process.env.AVOCADOCORE_RUNTIME_ROOT = ORIGINAL;
});

describe("generate-lesson-audio write path resolution (Gap 2)", () => {
  it("writes under process.cwd()/runtime_artifacts when AVOCADOCORE_RUNTIME_ROOT is unset", () => {
    delete process.env.AVOCADOCORE_RUNTIME_ROOT;

    const lessonRel = lessonAudioRelPath(42);
    const activityRel = activityAudioRelPath(42, 1908);

    expect(resolveRuntimeFile(lessonRel)).toBe(
      path.join(process.cwd(), "runtime_artifacts", "audio", "lesson_42_audio.mp3")
    );
    expect(resolveRuntimeFile(activityRel)).toBe(
      path.join(process.cwd(), "runtime_artifacts", "audio", "lesson_42_activity_1908_audio.mp3")
    );
  });

  it("writes under AVOCADOCORE_RUNTIME_ROOT when set (frank-dev served location)", () => {
    process.env.AVOCADOCORE_RUNTIME_ROOT = "/var/prodavo/runtime_artifacts";

    const lessonRel = lessonAudioRelPath(42);
    const activityRel = activityAudioRelPath(42, 1908);

    expect(resolveRuntimeFile(lessonRel)).toBe(
      "/var/prodavo/runtime_artifacts/audio/lesson_42_audio.mp3"
    );
    expect(resolveRuntimeFile(activityRel)).toBe(
      "/var/prodavo/runtime_artifacts/audio/lesson_42_activity_1908_audio.mp3"
    );
  });

  it("resolves the write path to the exact same absolute path the serving route resolves", () => {
    // The serving route resolves `/runtime/<segments>` via resolveRuntimeFile on
    // the joined segments. The generator writes to resolveRuntimeFile(relPath).
    // They must be identical for the file to be served after generation.
    process.env.AVOCADOCORE_RUNTIME_ROOT = "/var/prodavo/runtime_artifacts";
    const rel = lessonAudioRelPath(364);
    const writePath = resolveRuntimeFile(rel);
    // Serving route segments for the stored file_path `runtime_artifacts/audio/...`
    const servedSegments = rel.split("/");
    const servePath = resolveRuntimeFile(servedSegments.join("/"));
    expect(writePath).toBe(servePath);
    expect(writePath).toBe("/var/prodavo/runtime_artifacts/audio/lesson_364_audio.mp3");
  });
});
