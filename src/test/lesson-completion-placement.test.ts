import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Lesson completion placement", () => {
  it("keeps the lesson completion action only in the bottom action row", () => {
    const source = readFileSync(join(process.cwd(), "src/app/lessons/[id]/page.tsx"), "utf8");
    const completionBindings = source.match(/onClick=\{handleComplete\}/g) ?? [];
    const lessonUiBeforeBottomActions = source.slice(
      source.indexOf("Sticky top bar"),
      source.indexOf("Bottom action row")
    );

    expect(completionBindings).toHaveLength(1);
    expect(source.indexOf("onClick={handleComplete}")).toBeGreaterThan(source.indexOf("Bottom action row"));
    expect(lessonUiBeforeBottomActions).not.toMatch(/Mark (?:Lesson )?Complete|handleComplete/);
  });
});
