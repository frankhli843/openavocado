/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LessonChatModal } from "@/components/lesson/LessonChatModal";

describe("LessonChatModal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ enabled: true, messages: [] })))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the launcher above fullscreen coding focus mode", () => {
    render(<LessonChatModal lessonId={7} learnerId={1} lessonTitle="Inside the Transformer" />);

    expect(screen.getByRole("button", { name: /ask a lesson question/i })).toHaveClass("z-[70]");
  });

  it("requests the persistent right rail when maximized", async () => {
    const onMaximizedChange = vi.fn();
    render(
      <LessonChatModal
        lessonId={7}
        learnerId={1}
        lessonTitle="Inside the Transformer"
        onMaximizedChange={onMaximizedChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /ask a lesson question/i }));
    await screen.findByText(/ask a quick question about the current lesson/i);
    fireEvent.click(screen.getByRole("button", { name: /maximize lesson chat/i }));

    expect(onMaximizedChange).toHaveBeenLastCalledWith(true);
  });

  it("renders maximized chat as a desktop right rail and mobile fullscreen panel", async () => {
    render(
      <LessonChatModal
        lessonId={7}
        learnerId={1}
        lessonTitle="Inside the Transformer"
        maximized
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /ask a lesson question/i }));
    await screen.findByText(/ask a quick question about the current lesson/i);

    const dialog = screen.getByRole("dialog", { name: /lesson questions/i });
    expect(dialog).toHaveClass("fixed");
    expect(dialog).toHaveClass("inset-0");
    expect(dialog).toHaveClass("xl:w-[28rem]");
    expect(dialog).toHaveClass("xl:border-l");
    expect(screen.getByRole("button", { name: /return lesson chat to floating window/i })).toBeInTheDocument();
  });

  it("shows and sends the active lesson section context", async () => {
    render(
      <LessonChatModal
        lessonId={7}
        learnerId={1}
        lessonTitle="Inside the Transformer"
        activeSectionId="section-41"
        activeSectionLabel="Interactive: Visible context tokens"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /ask a lesson question/i }));
    expect(await screen.findByText("Context: Interactive: Visible context tokens")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/ask a quick question/i), {
      target: { value: "What should I notice here?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send question/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/lessons/7/chat",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            learner_id: 1,
            message: "What should I notice here?",
            current_section_id: "section-41",
          }),
        })
      );
    });
  });
});
