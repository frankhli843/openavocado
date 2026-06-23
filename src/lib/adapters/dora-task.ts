import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  RegenerationHookAdapter,
  LessonDiscardedEvent,
} from "@/types";

/**
 * Dora-task adapter — creates a Doramon todo-loop task for next-lesson generation.
 *
 * This adapter is deployment-specific. It expects local config (gitignored .env) to
 * provide the Doramon endpoint or CLI path. The reusable repo ships this as a reference
 * implementation, not hardcoded with any personal IDs.
 *
 * Required env vars:
 *   AVOCADOCORE_DORA_ENDPOINT  — HTTP endpoint to POST to (optional, falls back to CLI)
 *   AVOCADOCORE_DORA_PROJECT   — Doramon project slug for next-lesson tasks
 *   AVOCADOCORE_DORA_CHANNEL   — Discord channel ID for post-generation review (optional)
 */
export const doraTaskAdapter: CompletionHookAdapter = {
  name: "dora-task",
  async dispatch(event: LessonCompletedEvent, config?: Record<string, unknown>) {
    const endpoint =
      (config?.endpoint as string | undefined) ||
      process.env.AVOCADOCORE_DORA_ENDPOINT;
    const project =
      (config?.project as string | undefined) ||
      process.env.AVOCADOCORE_DORA_PROJECT ||
      "avocadocore";
    const channel =
      (config?.channel as string | undefined) ||
      process.env.AVOCADOCORE_DORA_CHANNEL;

    if (!endpoint) {
      // No endpoint configured — fall back to logging for local development
      console.warn("[completion:dora-task] No AVOCADOCORE_DORA_ENDPOINT set. Logging event only.");
      console.log("[completion:dora-task] Event:", JSON.stringify(event, null, 2));
      return {
        ok: false,
        error: "dora-task adapter: no endpoint configured (AVOCADOCORE_DORA_ENDPOINT)",
      };
    }

    // Build acceptance criteria for the next-lesson Dora task.
    // The generator must FIRST use subject-specific evidence (goals, criteria,
    // workpad, this lesson's answers, quiz, diagnostics, tag+difficulty
    // performance, mastery signals, completed/discarded lessons, misconceptions).
    // Profile config + cross-subject history are secondary, used only when they
    // help find the fastest path to mastery. The pedagogical goal is to find
    // foundational weaknesses and bridge them with the least learner effort,
    // while advancing the curriculum when the foundation is solid.
    const fmtTagPerf = event.tag_difficulty_performance.length
      ? event.tag_difficulty_performance
          .map(
            (p) =>
              `  - ${p.tag} [${p.difficulty}]: ${p.correct} correct, ${p.incorrect} wrong, ${p.idk} "don't know" (of ${p.total})`
          )
          .join("\n")
      : "  (no tagged attempts recorded)";
    const fmtDiagnostics = event.next_lesson_diagnostics.length
      ? event.next_lesson_diagnostics.map((d) => `  - Q: ${d.prompt}\n    A: ${d.answer}`).join("\n")
      : "  (no diagnostics answered)";

    const acceptance = [
      `Generate the next lesson for subject "${event.subject_title}" (learner ${event.learner_id}).`,
      `Be adaptive to the evidence below — do NOT produce a generic next chapter.`,
      ``,
      `=== PEDAGOGICAL GOAL ===`,
      `Find foundational weaknesses and bridge them as fast as possible with the least learner effort.`,
      `Advance the curriculum only where the foundation is already solid. Prioritise subject-specific`,
      `evidence first; use profile config + cross-subject history only if they speed up mastery.`,
      ``,
      `=== SUBJECT CONTEXT (use first) ===`,
      `Goals: ${event.subject_goals || "(none set)"}`,
      `Learner criteria/notes: ${event.subject_criteria || "(none set)"}`,
      event.workpad_summary ? `AI workpad (current plan):\n${event.workpad_summary}` : `AI workpad: (none yet)`,
      ``,
      `=== THIS LESSON ===`,
      `Prior lesson: "${event.lesson_title}"  | Goals: ${event.lesson_goals.join(", ")}`,
      event.quiz_result
        ? `Quiz: ${event.quiz_result.passed ? "passed" : "not passed"} (${event.quiz_result.correct_count}/${event.quiz_result.pass_threshold})`
        : `Quiz: (none)`,
      `Freeform assessment Q&A:`,
      event.assessment_qa.map((qa) => `  - Q: ${qa.question}\n    A: ${qa.learner_answer}`).join("\n"),
      ``,
      `=== TAG + DIFFICULTY PERFORMANCE (the queryable evidence) ===`,
      fmtTagPerf,
      ``,
      `=== END-OF-LESSON DIAGNOSTICS (what the learner wants next) ===`,
      fmtDiagnostics,
      ``,
      `=== MASTERY SIGNALS ===`,
      `Concepts to review: ${event.concepts_to_review.join(", ") || "none"}`,
      `Concepts ready to advance: ${event.concepts_ready_to_advance.join(", ") || "none"}`,
      `Recent misconceptions: ${event.recent_misconceptions.join(", ") || "none"}`,
      ``,
      `=== CURRICULUM CONTEXT ===`,
      `Completed lessons: ${event.completed_lessons.map((l) => l.title).join("; ") || "none"}`,
      `Discarded lessons (avoid repeating): ${event.discarded_lessons.map((l) => `${l.title}${l.reason ? ` (${l.reason})` : ""}`).join("; ") || "none"}`,
      ``,
      `=== SECONDARY CONTEXT (use only if it helps) ===`,
      `Profile config: ${event.learner_profile_config ? JSON.stringify(event.learner_profile_config) : "(none)"}`,
      `Cross-subject mastery: ${event.cross_subject_history.map((c) => `${c.subject_title}=${c.mastery_score ?? "n/a"}`).join(", ") || "(none)"}`,
      ``,
      `Delivery:`,
      channel
        ? `After generating the next lesson, post a review in <#${channel}> explaining which answers were right, which were wrong, why, and how the next lesson bridges the foundational gaps. Tag the learner in the thread.`
        : `After generating the next lesson, confirm completion in the appropriate channel.`,
    ].join("\n");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          title: `Generate next lesson: ${event.subject_title} (after "${event.lesson_title}")`,
          acceptance,
          origin_platform: "avocadocore",
          metadata: { lesson_completed_event: event },
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `dora endpoint responded with ${res.status}` };
      }

      const data = (await res.json()) as { id?: string };
      const ref = data.id || `dora-task-${Date.now()}`;
      return { ok: true, ref };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};

/**
 * Dora-task regeneration adapter — creates a Doramon todo-loop task for
 * replacement lesson generation after a learner discards an incomplete lesson.
 *
 * The generated task explicitly passes:
 *  - subject goals and criteria/notes (so the replacement isn't a blind regeneration)
 *  - the discarded lesson metadata and learner's stated reason
 *  - mastery signals and completed lesson history for context
 *  - current workpad summary if available
 *
 * Required env vars: same as doraTaskAdapter (AVOCADOCORE_DORA_ENDPOINT, etc.)
 */
export const doraTaskRegenerationAdapter: RegenerationHookAdapter = {
  name: "dora-task",
  async dispatch(event: LessonDiscardedEvent, config?: Record<string, unknown>) {
    const endpoint =
      (config?.endpoint as string | undefined) ||
      process.env.AVOCADOCORE_DORA_ENDPOINT;
    const project =
      (config?.project as string | undefined) ||
      process.env.AVOCADOCORE_DORA_PROJECT ||
      "avocadocore";
    const channel =
      (config?.channel as string | undefined) ||
      process.env.AVOCADOCORE_DORA_CHANNEL;

    if (!endpoint) {
      console.warn(
        "[regeneration:dora-task] No AVOCADOCORE_DORA_ENDPOINT set. Logging event only."
      );
      console.log("[regeneration:dora-task] Event:", JSON.stringify(event, null, 2));
      return {
        ok: false,
        error: "dora-task regeneration adapter: no endpoint configured (AVOCADOCORE_DORA_ENDPOINT)",
      };
    }

    // Build a detailed acceptance task for the replacement lesson.
    // Critically: include subject criteria + discard reason so the generator
    // does NOT blindly regenerate the same lesson.
    const acceptance = [
      `Generate a REPLACEMENT lesson for subject "${event.subject_title}" (learner ${event.learner_id}).`,
      ``,
      `IMPORTANT: The learner discarded the previous lesson. This is NOT a retry of the same lesson.`,
      `Read the subject context carefully and generate a better-aligned lesson.`,
      ``,
      `=== SUBJECT CONTEXT ===`,
      `Title: ${event.subject_title}`,
      event.subject_description ? `Description: ${event.subject_description}` : "",
      event.subject_goals ? `Learning goals:\n${event.subject_goals}` : "",
      event.subject_criteria
        ? `Learner criteria / notes for lesson generator:\n${event.subject_criteria}`
        : "(no learner criteria set — use subject goals and progress signals as the main guide)",
      ``,
      `=== DISCARDED LESSON ===`,
      `Lesson: "${event.discarded_lesson_title}" (id: ${event.discarded_lesson_id})`,
      `Status at discard: ${event.discarded_lesson_status}`,
      event.discard_reason
        ? `Learner's reason for discarding: ${event.discard_reason}`
        : "(learner did not provide a specific reason)",
      ``,
      `=== LEARNING PROGRESS ===`,
      `Mastery score: ${event.mastery_score !== null ? `${event.mastery_score.toFixed(0)}/100` : "not yet measured"}`,
      event.completed_lessons.length > 0
        ? `Completed lessons:\n${event.completed_lessons.map((l) => `  - ${l.title} (${l.completed_at.slice(0, 10)})`).join("\n")}`
        : "No completed lessons yet.",
      event.mastery_signals.length > 0
        ? `Mastery signals:\n${event.mastery_signals
            .slice(0, 10)
            .map((s) => `  - [${s.signal_type}] ${s.concept}${s.detail ? `: ${s.detail}` : ""}`)
            .join("\n")}`
        : "No mastery signals recorded yet.",
      ``,
      event.workpad_summary
        ? `=== AI WORKPAD (current plan summary) ===\n${event.workpad_summary}\n`
        : "",
      `=== INSTRUCTIONS ===`,
      `Before writing the replacement lesson:`,
      `1. Review the subject goals and learner criteria above.`,
      `2. Consider why the learner discarded the previous lesson (reason provided above).`,
      `3. If the learner gave a specific reason (too easy / too hard / wrong topic / bad style / etc.),`,
      `   explicitly address that in the replacement.`,
      `4. Review the AI workpad (if available) for current plan and open questions.`,
      `5. Update the workpad with what you decided and why, then include the workpad delta in your task notes.`,
      `6. Generate a lesson that better fits the learner's goals, criteria, and current level.`,
      ``,
      `Completion:`,
      channel
        ? `After generating the replacement lesson, post a summary in <#${channel}> explaining ` +
          `what changed vs the discarded lesson and how it addresses the learner's feedback. ` +
          `Tag the learner in the thread.`
        : `After generating the replacement lesson, confirm completion in the appropriate channel.`,
    ]
      .filter((line) => line !== "")
      .join("\n");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          title: `Generate replacement lesson: ${event.subject_title} (discarded "${event.discarded_lesson_title}")`,
          acceptance,
          origin_platform: "avocadocore",
          metadata: { lesson_discarded_event: event },
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `dora endpoint responded with ${res.status}` };
      }

      const data = (await res.json()) as { id?: string };
      const ref = data.id || `dora-regen-task-${Date.now()}`;
      return { ok: true, ref };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },
};
