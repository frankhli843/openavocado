/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { OnTheGoLessonMode } from "@/components/lesson/OnTheGoLessonMode";
import type { GeneratedArtifact, Lesson, LessonActivity } from "@/types";

const NOW = "2026-07-16T00:00:00.000Z";

function makeLesson(): Lesson {
  return {
    id: 28,
    subject_id: 3,
    title: "How Gemma Actually Gets Built",
    description: "Leaderboards, compliant architectures, and why evals decide.",
    status: "in_progress",
    goals: null,
    knowledge_graph_data: null,
    next_lesson_diagnostics: null,
    created_at: NOW,
    updated_at: NOW,
  } as unknown as Lesson;
}

function makeActivity(
  id: number,
  activityType: string,
  title: string,
  content: Record<string, unknown> | null
): LessonActivity {
  return {
    id,
    lesson_id: 28,
    activity_type: activityType,
    is_core: 1,
    sequence_order: id,
    title,
    content: content ? JSON.stringify(content) : null,
    created_at: NOW,
    updated_at: NOW,
  } as unknown as LessonActivity;
}

function makeAudioArtifact(id: number, activityId: number, filePath: string): GeneratedArtifact {
  return {
    id,
    lesson_id: 28,
    activity_id: activityId,
    artifact_type: "audio",
    provider: "edge-tts",
    voice: "en-US-BrianNeural",
    duration_sec: 900,
    content_hash: `sha256:${id}`,
    file_path: filePath,
    object_key: null,
    source_script: null,
    created_at: NOW,
    updated_at: NOW,
  } as unknown as GeneratedArtifact;
}

const PART_CONTENT = {
  part_id: "part-1",
  reading: { blocks: [] },
  audio: { script: "Narration.", duration_hint: 300 },
  practice: null,
};

function renderMode(activities: LessonActivity[], artifacts: GeneratedArtifact[] = []) {
  return render(
    <OnTheGoLessonMode
      lesson={makeLesson()}
      activities={activities}
      artifacts={artifacts}
      sectionDone={{}}
      partQuizStates={{}}
      assessContext={{ learnerId: 1, subjectId: 3, lessonId: 28 }}
      completionBlocked={false}
      completing={false}
      assessmentQuizState={null}
      onAssessmentQuizStateChange={vi.fn()}
      onAssessmentQuizPassedChange={vi.fn()}
      onBackToNormal={vi.fn()}
      onSectionDoneChange={vi.fn()}
      onPartQuizStateChange={vi.fn()}
      onCompleteLesson={vi.fn()}
    />
  );
}

describe("OnTheGoLessonMode card sequence", () => {
  it("starts with the lesson overview so the main video is not skipped", () => {
    renderMode(
      [
        makeActivity(164, "audio", "Video: How Gemma actually gets built", {
          script: "Overview narration.",
          duration_hint: 900,
          orientation_video: {
            file_path: "runtime_artifacts/videos/lesson_28/activity_164.mp4",
            duration_sec: 890.8,
            width: 1920,
            height: 1080,
          },
        }),
        makeActivity(165, "lesson_part", "Part 1", PART_CONTENT),
      ],
      [makeAudioArtifact(324, 164, "runtime_artifacts/audio/lesson_28_audio.mp3")]
    );

    const firstCard = screen.getByLabelText("Card 1 of 5");
    expect(firstCard).toHaveTextContent("Video: How Gemma actually gets built");
    expect(firstCard.querySelector("video source")).toHaveAttribute(
      "src",
      "/runtime/runtime_artifacts/videos/lesson_28/activity_164.mp4"
    );
  });

  it("falls back to the overview audio artifact when no overview video exists", () => {
    renderMode(
      [
        makeActivity(164, "audio", "Overview", { script: "Overview narration.", duration_hint: 900 }),
        makeActivity(165, "lesson_part", "Part 1", PART_CONTENT),
      ],
      [makeAudioArtifact(324, 164, "runtime_artifacts/audio/lesson_28_audio.mp3")]
    );

    const firstCard = screen.getByLabelText("Card 1 of 5");
    expect(firstCard.querySelector("audio")).toHaveAttribute(
      "src",
      "/runtime/runtime_artifacts/audio/lesson_28_audio.mp3"
    );
  });

  it("includes a final quiz card before the finish card when the assessment has a quiz", () => {
    renderMode([
      makeActivity(165, "lesson_part", "Part 1", PART_CONTENT),
      makeActivity(169, "assessment", "Assessment", {
        questions: [],
        quiz: {
          questions: [
            {
              id: "q1",
              question: "Pick one.",
              choices: ["A", "B"],
              correct_index: 0,
              explanation: "A is right.",
              concept: "demo",
              difficulty: "easy",
            },
          ],
        },
      }),
    ]);

    // Cards: media, practice, sectionDone, finalQuiz, lessonDone.
    const quizCard = screen.getByLabelText("Card 4 of 5");
    expect(quizCard).toHaveTextContent("Final quiz");
    expect(screen.getByLabelText("Card 5 of 5")).toHaveTextContent("Finish lesson");
  });

  it("omits the final quiz card when the assessment has no quiz", () => {
    renderMode([
      makeActivity(165, "lesson_part", "Part 1", PART_CONTENT),
      makeActivity(169, "assessment", "Assessment", { questions: [] }),
    ]);

    expect(screen.getByLabelText("Card 4 of 4")).toHaveTextContent("Finish lesson");
    expect(screen.queryByText("Final quiz")).not.toBeInTheDocument();
  });

  it("points to the coding exercise staying in normal mode when the lesson has one", () => {
    renderMode([
      makeActivity(165, "lesson_part", "Part 1", PART_CONTENT),
      makeActivity(168, "practice_code", "Integrator", { starter_code: "x = 1" }),
    ]);

    expect(screen.getByText(/coding exercise that is easier at a desk/i)).toBeInTheDocument();
  });
});

describe("SegmentVideoPlayer captions", () => {
  it("keeps captions opt-in so cue overlays never cover the stage by default", () => {
    renderMode([
      makeActivity(165, "lesson_part", "Part 1", {
        ...PART_CONTENT,
        audio: {
          ...PART_CONTENT.audio,
          video: {
            file_path: "runtime_artifacts/videos/lesson_28/activity_165.mp4",
            captions_path: "runtime_artifacts/videos/lesson_28/activity_165.vtt",
            duration_sec: 300,
            width: 1920,
            height: 1080,
          },
        },
      }),
    ]);

    const track = document.querySelector("track");
    expect(track).not.toBeNull();
    expect(track).not.toHaveAttribute("default");
  });
});
