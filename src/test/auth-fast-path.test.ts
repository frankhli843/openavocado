import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("auth fast path", () => {
  it("does not synchronously generate lesson audio while resolving /api/auth/me", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/auth/session.ts"), "utf8");

    expect(source).not.toContain("ensureDemoLessonAudioForLearner");
  });
});
