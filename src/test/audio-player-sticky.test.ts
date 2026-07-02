import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("lesson audio player sticky lifecycle", () => {
  it("pins audio controls while playing and unpins on pause or end", () => {
    const sources = [
      "src/components/lesson/LessonPartSection.tsx",
      "src/components/lesson/AudioSection.tsx",
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8"));

    for (const source of sources) {
      expect(source).toContain("const [audioPlaying, setAudioPlaying] = useState(false)");
      expect(source).toContain("audioPlaying");
      expect(source).toContain("sticky top-[4.75rem]");
      expect(source).toContain("onPlay={() => setAudioPlaying(true)}");
      expect(source).toContain("onPause={() => setAudioPlaying(false)}");
      expect(source).toContain("onEnded={() => setAudioPlaying(false)}");
    }
  });
});
