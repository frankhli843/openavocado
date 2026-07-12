/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { AudioSection } from "@/components/lesson/AudioSection";
import type { GeneratedArtifact, LessonActivity } from "@/types";

describe("AudioSection", () => {
  it("shows learner-facing audio without provider or voice debug metadata", () => {
    const activity: LessonActivity = {
      id: 84,
      lesson_id: 15,
      activity_type: "audio",
      is_core: 1,
      sequence_order: 1,
      title: "Orientation: What Happens Inside One Transformer Block",
      content: JSON.stringify({
        script: "Leo: Let us follow the hidden-state rows.\n\nMaya: What changes inside the block?",
        transcript:
          "Leo: Let us follow the hidden-state rows.\n\nMaya: What changes inside the block?",
        duration_hint: 900,
      }),
      created_at: "2026-07-04T00:00:00.000Z",
      updated_at: "2026-07-04T00:00:00.000Z",
    };
    const artifact: GeneratedArtifact = {
      id: 1,
      lesson_id: 15,
      activity_id: 84,
      artifact_type: "audio",
      provider: "edge-tts",
      voice: "en-US-BrianNeural+en-US-AvaNeural",
      duration_sec: 960,
      content_hash: "sha256:abc",
      file_path: "runtime_artifacts/audio/lesson_15_audio.mp3",
      object_key: null,
      source_script: null,
      script_version: "sha256:abc",
      generated_at: "2026-07-04T00:00:00.000Z",
      created_at: "2026-07-04T00:00:00.000Z",
    };

    render(<AudioSection activity={activity} artifact={artifact} />);

    expect(
      screen.getByRole("heading", {
        name: "Orientation: What Happens Inside One Transformer Block",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("16 min")).toBeInTheDocument();
    expect(screen.queryByText(/Audio Session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Provider:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Voice:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/edge-tts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/BrianNeural/i)).not.toBeInTheDocument();
  });
});
