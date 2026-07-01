export const COMPREHENSIVE_LESSON_PLAN_TITLE = "Comprehensive Avo Lesson Plan";

export const COMPREHENSIVE_LESSON_PLAN_TEMPLATE = [
  "=== COMPREHENSIVE AVO LESSON PLAN (required evolving artifact) ===",
  "Every lesson-generation phase must create or update a durable subject-level roadmap before authoring the lesson. This roadmap lives in the subject workpad as the mutable latest plan and is summarized in the subject journal as the append-only audit trail. It is not optional planning prose. It is the long-horizon curriculum brain for both local Avo and prod Avo.",
  "",
  "Minimum length requirements:",
  "- Full roadmap update: at least 1,500 words for normal technical subjects, or at least 1,000 words for short non-technical subjects. If the subject goal is broad, such as building an LLM, contributing to Gemma, inference, quantization, GGUF, or frontier-paper study, use at least 2,000 words.",
  "- Evidence ledger: at least 8 concrete evidence entries, unless fewer than 8 exist. Include SQLite row ids, lesson ids, assessment ids, workpad/journal references, generated artifact slugs, source URLs, paper/docs titles, or explicit notes that evidence is missing.",
  "- Near-term plan: at least the next 3 lessons, each with at least 250 words. The immediate next lesson must be the most detailed.",
  "- Mid-term plan: at least lessons 4 to 8 ahead, each with at least 120 words. These should be directional but still specific.",
  "- Long-term horizon: at least 5 future milestones beyond the next 8 lessons, each with at least 1,000 words. These can be lower resolution than the immediate next lesson, but each milestone must still name likely concepts, evidence required, references to consult, visuals/practice likely needed, phase implications, and resequencing triggers.",
  "- References: at least 5 references for technical subjects. Prefer official docs, papers, textbooks, course syllabi, high-quality public educational material, and prior AvocadoCore evidence. If live research is unavailable in a deterministic local fixture, say that clearly and list internal evidence references instead.",
  "",
  "Required headings and content:",
  "1. Subject Goal And Learner Outcome: restate the learner's goal, success criteria, current phase, and what the learner should eventually be able to do in real work.",
  "2. Evidence Consulted: list the exact internal and external evidence used. Include learner profile, subject goals, completed lessons, incomplete lessons, discarded lessons, assessments, diagnostics, mastery signals, code attempts, artifacts, workpad, journal, generation jobs, and cross-subject history when present.",
  "3. Current Learner Model: explain what the learner appears to understand, what is only previewed, what is weak or unproven, and which assumptions are forbidden because evidence is missing.",
  "4. Phase Decision: describe whether the learner is in familiarity, competence, mastery, or post-mastery. This must be an AI semantic decision from the evidence, not a numeric threshold. Name the exact evidence that would justify advancing or recalibrating.",
  "5. Course And Reference Map: summarize relevant syllabi, docs, papers, videos, or source material. Explain what sequence those sources imply and how Avo is adapting that sequence for this learner.",
  "6. Near-Term Detailed Plan: write the next 3 lessons in high detail. For each lesson include: purpose, prerequisite concepts to define, concepts to avoid assuming, concrete examples, visuals needed, audio-synced scene plan, practice types, code section, assessment evidence to collect, and what would cause the next lesson to change.",
  "7. Mid-Term Plan: sketch lessons 4 to 8 with enough detail that a future generator can see the intended arc, dependencies, and evidence gates.",
  "8. Long-Term Horizon: describe later milestones, including competence, mastery, and post-mastery paper-based lessons when appropriate. For frontier work, name the kind of paper to search for and what evidence proves the learner is ready. Each horizon milestone must be at least 1,000 words, even though it is expected to be revised later.",
  "9. Resequencing Rules: list learner answers, misconceptions, code failures, or interests that should change the plan. Avoid fixed thresholds. Use evidence semantics.",
  "10. References And Citations: give source names, URLs or internal row references, why each source matters, and which lesson stage it informs.",
  "11. What Changed Since The Previous Plan: summarize additions, removals, compressed history, and why the roadmap changed.",
  "",
  "Planning resolution rule:",
  "The plan should be most detailed for the immediate next lesson, detailed but flexible for the next 2 lessons, lower resolution for the mid-term, and strategic for the long-term. Do not pretend future lessons are locked. The AI updates the plan after every new lesson generation, completion, discard, QA pass, or backfill.",
  "",
  "Local/prod compatibility:",
  "Local deterministic fixtures must still write this plan shape, but may label live research as unavailable and use internal evidence references. Prod harnesses and Dora-task workers must use tool-capable research and include external references when the topic requires current knowledge.",
].join("\n");

export function buildFixtureComprehensivePlan(params: {
  subjectTitle: string;
  currentLevel: string;
  generatedLessonTitle: string;
  generatedLessonId: number;
  completedLessonTitle: string;
  completedLessonId: number;
  reviewFocus: string;
  readyFocus: string;
  phaseReason?: string;
  nextDirective?: string;
  generatedAt?: string;
}): string {
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const phaseReason =
    params.phaseReason?.trim() ||
    "The deterministic local fixture cannot make a semantic graduation decision by itself, so it preserves the current phase and records the need for AI review.";
  const nextDirective =
    params.nextDirective?.trim() ||
    `Use the next lesson to connect ${params.reviewFocus} to ${params.readyFocus} with concrete examples and learner evidence.`;

  return [
    `# ${COMPREHENSIVE_LESSON_PLAN_TITLE}`,
    "",
    `Updated: ${generatedAt}`,
    `Generator: prodavo-local-queue/v1 deterministic fixture`,
    `Subject: ${params.subjectTitle}`,
    `Current phase: ${params.currentLevel}`,
    "",
    "## 1. Subject Goal And Learner Outcome",
    `${params.subjectTitle} should become a coherent, usable learning path rather than a sequence of isolated generated lessons. The learner should be able to explain the subject at a high level, identify the important objects and operations, practice those operations, and eventually transfer the ideas into real work. Because this update came from the deterministic local queue, it records the durable planning structure that prod and local Avo both expect, while clearly marking that deep external research and semantic phase judgment should be supplied by the AI harness when available.`,
    "",
    "## 2. Evidence Consulted",
    `- Completed lesson id ${params.completedLessonId}: ${params.completedLessonTitle}.`,
    `- Generated next lesson id ${params.generatedLessonId}: ${params.generatedLessonTitle}.`,
    `- Current review focus from completion event: ${params.reviewFocus}.`,
    `- Current advance focus from completion event: ${params.readyFocus}.`,
    `- Phase reason from latest level progression event: ${phaseReason}`,
    `- Next lesson directive from phase event or fixture policy: ${nextDirective}`,
    "- Internal source: lesson completion event payload.",
    "- Internal source: subject row current_level.",
    "- Internal source: local queue generation diagnostics.",
    "- External references: not available in deterministic fixture mode. A prod harness or Dora task must replace this section with official docs, papers, syllabi, or other verified references before shipping a research-sensitive lesson.",
    "",
    "## 3. Current Learner Model",
    `The learner has completed at least one step in ${params.subjectTitle}, but the fixture does not infer competence from completion alone. It treats completion as evidence that the learner engaged with the previous lesson, not proof that the learner can transfer the concept. The next generated lesson should therefore keep the object-operation-evidence pattern visible: name the object, show the operation, then collect evidence that the operation made sense. The review focus is ${params.reviewFocus}; the forward focus is ${params.readyFocus}. If those ideas are only weakly connected in the learner evidence, the next lesson should bridge them instead of jumping into later details.`,
    "",
    "## 4. Phase Decision",
    `Stored phase is ${params.currentLevel}. The local queue does not graduate or demote by heuristic. The AI phase evaluator must inspect assessments, mastery signals, diagnostics, code attempts, workpad, journal, completed and discarded lessons, and cross-subject history to decide whether the stored phase is accurate. Until that semantic decision exists, the plan should hold the current phase and use lesson evidence to refine the roadmap. For broad model-building tracks, familiarity means the learner needs a coherent map of data, tokenization, embeddings, transformer blocks, training, checkpointing, inference, quantization, packaging, and release before competence lessons dive deeply into each mechanism.`,
    "",
    "## 5. Course And Reference Map",
    "This fixture cannot browse, so it records the reference categories the prod harness must fill in: official framework or model documentation, relevant papers, high-quality course syllabi, implementation guides, and prior Avo lessons. For an LLM-building subject, the reference map should compare several sources: a model architecture explanation, a training or fine-tuning guide, tokenizer documentation, inference or serving docs, and a quantization or GGUF packaging source. The plan should adapt that source sequence to the learner's evidence rather than copying any syllabus blindly.",
    "",
    "## 6. Near-Term Detailed Plan",
    `Lesson 1 ahead, immediate: ${params.generatedLessonTitle}. This lesson should make ${params.reviewFocus} concrete and connect it to ${params.readyFocus}. It should define every major noun it relies on, use at least one concrete worked example, include a visual that shows what enters the section, what changes, and what gets passed forward, and collect assessment evidence about whether the learner can describe the object-operation-evidence chain. If the learner cannot name the concrete object or cannot explain why the operation matters, the following lesson should stay in familiarity and repair the bridge.`,
    "",
    `Lesson 2 ahead: use the evidence from ${params.generatedLessonTitle} to decide whether to deepen ${params.readyFocus} or repair ${params.reviewFocus}. The plan should be detailed enough to generate a lesson but flexible about scope. It should include a mechanism trace, mixed practice, a small code exercise if the subject is technical, and explicit look-ahead diagnostics. The lesson should avoid assuming that lesson completion equals understanding. It should use written answers and code/test feedback to determine whether the learner can transfer the idea into a fresh example.`,
    "",
    `Lesson 3 ahead: expand from the immediate bridge into the next natural stage of ${params.subjectTitle}. This should be the first lesson that tests whether the learner's map is becoming stable across examples. It should revisit the earliest important concepts briefly, then add one new mechanism or decision point. The assessment should include ordering, select-all, written explanation, and a small application task. The plan should change if the learner's diagnostics show a different priority or if the AI phase evaluator recalibrates the stored phase.`,
    "",
    "## 7. Mid-Term Plan",
    "Lessons 4 to 8 should broaden the subject map while preserving review. Each lesson should introduce one main object or mechanism, connect it to earlier objects, show the handoff, and ask the learner to explain what would break if the step were skipped. The exact topics depend on the subject, but the pattern should remain: define the object, show the operation, practice the operation, collect evidence, then update the plan. For LLM-building, this horizon likely covers tokenizer and embedding handoff, transformer-block intuition, output logits, training loss, checkpoint artifacts, inference flow, and practical packaging choices.",
    "",
    "## 8. Long-Term Horizon",
    "Milestone A, familiarity completion map. This milestone remains at strategic resolution in the deterministic fixture, but a production harness must expand it to at least 1,000 words. The learner should connect the major subject stages into one map, name the object passed between stages, and explain why each stage exists. For an LLM-building subject, this means seeing data, tokenizer, token IDs, embedding lookup, hidden states, transformer blocks, output head, logits, loss, training updates, checkpoint artifacts, inference, sampling, KV cache, quantization, GGUF, llama.cpp, Hugging Face release, and Gemma contribution workflow as related parts of one lifecycle. The evidence required is not lesson count. It is learner explanation quality across written answers, mixed practice, diagnostics, and code traces. If the learner still treats terms as isolated vocabulary, the plan should stay in familiarity.",
    "",
    "Milestone B, competence mechanisms. This milestone must become a 1,000+ word section in the AI harness plan. It should deepen the important mechanics after the high-level map is stable: tensor shapes, learned weights, why embeddings are not tokenizers, how transformer blocks preserve sequence length while changing values, how logits become probabilities, how training differs from inference, and how runtime constraints shape serving. Lessons here should include concrete micro-traces, code exercises, and tests that reveal whether the learner can use the mechanism rather than merely recognize the name.",
    "",
    "Milestone C, mastery integration. This milestone must become a 1,000+ word section in the AI harness plan. It should ask the learner to transfer across contexts: diagnose a broken training or inference pipeline, compare tokenizer/model contract mismatches, explain quantization tradeoffs, and connect release artifacts to actual runtime behavior. Evidence should include written diagnosis, code/debugging submissions, and lesson-part practice that mixes old and new concepts without telegraphing the answer.",
    "",
    "Milestone D, applied contribution path. This milestone must become a 1,000+ word section in the AI harness plan. It should connect the subject to the learner's practical goal, such as contributing to Gemma or understanding model-building work at Google. It should include contribution workflows, release-card reading, reproducibility checks, model artifact inspection, and the difference between learning demos and production constraints. The AI should consult current official docs and project-specific references before authoring lessons here.",
    "",
    "Milestone E, post-mastery frontier papers. This milestone must become a 1,000+ word section in the AI harness plan. It should only activate after mastery evidence is strong. Avo should search for recent, relevant, well-cited or frontier papers, cite them, explain why each paper matters, and teach what the paper adds beyond the learner's foundation. If the learner lacks the required mechanism knowledge, the plan should defer paper study and generate a bridge lesson instead.",
    "",
    "## 9. Resequencing Rules",
    "Resequence when the learner's written answers reveal a missing prerequisite, when code attempts show a conceptual bug, when diagnostics ask for a different representation, when a discarded lesson exposes pacing or style mismatch, or when the AI phase evaluator decides the stored phase is ahead of the evidence. Do not resequence only because a numeric count crossed a threshold. Do not advance because a lesson was marked complete. Use semantic evidence.",
    "",
    "## 10. References And Citations",
    "- Internal evidence: completion event payload.",
    "- Internal evidence: generated lesson row.",
    "- Internal evidence: current subject phase.",
    "- Internal evidence: workpad update.",
    "- Required future external references: official docs, course maps, papers, or implementation references relevant to the exact subject.",
    "",
    "## 11. What Changed Since The Previous Plan",
    `The roadmap now includes ${params.generatedLessonTitle} as the immediate next queued lesson, records ${params.completedLessonTitle} as completed evidence, preserves ${params.reviewFocus} as review pressure, and identifies ${params.readyFocus} as the forward pressure. Future AI harness updates should replace this fixture scaffold with a richer researched plan while preserving the same headings and long-horizon structure.`,
  ].join("\n");
}
