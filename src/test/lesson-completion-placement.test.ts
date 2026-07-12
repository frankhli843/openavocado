import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Lesson action placement", () => {
  it("keeps lesson actions only in the bottom action row", () => {
    const source = readFileSync(join(process.cwd(), "src/app/lessons/[id]/page.tsx"), "utf8");
    const completionBindings = source.match(/onClick=\{handleComplete\}/g) ?? [];
    const discardBindings = source.match(/setShowDiscardModal\(true\)/g) ?? [];
    const beforeBottomActions = source.slice(source.indexOf("Breadcrumb row"), source.indexOf("Bottom action row"));
    const bottomActions = source.slice(source.indexOf("Bottom action row"));

    expect(completionBindings).toHaveLength(1);
    expect(discardBindings).toHaveLength(1);
    expect(source).not.toContain("Sticky top bar");
    expect(source).not.toContain("sticky top-0");
    expect(source.indexOf("onClick={handleComplete}")).toBeGreaterThan(source.indexOf("Bottom action row"));
    expect(source.indexOf("setShowDiscardModal(true)")).toBeGreaterThan(source.indexOf("Bottom action row"));
    expect(beforeBottomActions).not.toMatch(/Discard lesson|Discard"|Mark (?:Lesson )?Complete|handleComplete|setShowDiscardModal\(true\)/);
    expect(bottomActions).toMatch(/Discard lesson/);
    expect(bottomActions).toMatch(/Mark Lesson Complete/);
  });
});
