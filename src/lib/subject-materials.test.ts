import { describe, expect, it } from "vitest";
import { buildSourceMaterialsFromJson, sourceMaterialsToPrompt } from "./subject-materials";

describe("subject materials", () => {
  it("normalizes links and inline context into prompt-ready source material", () => {
    const materials = buildSourceMaterialsFromJson({
      source_links: "https://example.com/sara-meeting\nhttps://example.com/gemma-plan",
      source_text: "Meeting with Sara: focus on Gemma contribution path, benchmark evidence, and model release workflow.",
    });

    expect(materials).toHaveLength(3);
    expect(materials[0].type).toBe("link");
    expect(materials[2].type).toBe("text");

    const prompt = sourceMaterialsToPrompt(materials);
    expect(prompt).toContain("https://example.com/sara-meeting");
    expect(prompt).toContain("Meeting with Sara");
    expect(prompt).toContain("Gemma contribution path");
  });
});
