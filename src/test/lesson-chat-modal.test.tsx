/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { LessonChatModal } from "@/components/lesson/LessonChatModal";

describe("LessonChatModal", () => {
  it("keeps the launcher above fullscreen coding focus mode", () => {
    render(<LessonChatModal lessonId={7} learnerId={1} lessonTitle="Inside the Transformer" />);

    expect(screen.getByRole("button", { name: /ask a lesson question/i })).toHaveClass("z-[70]");
  });
});
