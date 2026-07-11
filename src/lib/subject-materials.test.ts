import { describe, expect, it } from "vitest";
import { buildSourceMaterialsFromJson, sourceMaterialsToPrompt } from "./subject-materials";

describe("subject materials", () => {
  it("normalizes links and inline context into prompt-ready source material", () => {
    const materials = buildSourceMaterialsFromJson({
      source_links: "https://example.com/team-meeting\nhttps://example.com/roadmap-plan",
      source_text: "Meeting notes: focus on the model release workflow, benchmark evidence, and next steps.",
    });

    expect(materials).toHaveLength(3);
    expect(materials[0].type).toBe("link");
    expect(materials[2].type).toBe("text");

    const prompt = sourceMaterialsToPrompt(materials);
    expect(prompt).toContain("https://example.com/team-meeting");
    expect(prompt).toContain("Meeting notes");
    expect(prompt).toContain("model release workflow");
  });
});
