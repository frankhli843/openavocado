import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("lesson audio player sticky lifecycle", () => {
  it("pins audio controls while playing and unpins on pause or end", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/lesson/LessonPartSection.tsx"),
      "utf8"
    );

    expect(source).toContain("const [audioPlaying, setAudioPlaying] = useState(false)");
    expect(source).toContain("audioPlaying");
    expect(source).toContain("sticky top-[4.75rem]");
    expect(source).toContain("onPlay={() => setAudioPlaying(true)}");
    expect(source).toContain("onPause={() => setAudioPlaying(false)}");
    expect(source).toContain("onEnded={() => setAudioPlaying(false)}");
  });
});
