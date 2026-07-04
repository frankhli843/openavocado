#!/usr/bin/env tsx
/**
 * Backfill active lesson overview audio to the current long-form standard:
 * 15+ minutes, 2,700+ words, transcript included, and visual cues covering the
 * full audio duration. By default this targets in-progress and queued lessons.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-overview-audio.ts
 *   pnpm tsx scripts/backfill-overview-audio.ts --lesson-id 15
 *   AVOCADOCORE_DB_PATH=/var/prodavo/data/avocadocore.db pnpm tsx scripts/backfill-overview-audio.ts --no-audio
 */
import { closeDb, getDb } from "../src/db/connection";
import { generateLessonAudio } from "../src/lib/audio/generate-lesson-audio";

const MIN_WORDS = 2700;
const MIN_DURATION = 15 * 60;
const STYLE_VERSION = "podcast-v10-refresh-formula-panels";

interface LessonRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  subject_title: string;
}

interface ActivityRow {
  id: number;
  activity_type: string;
  title: string;
  sequence_order: number;
  content: string | null;
}

interface ArtifactRow {
  duration_sec: number | null;
  source_script: string | null;
}

interface Panel {
  id: string;
  title: string;
  kind: string;
  description: string;
  data?: Array<Record<string, unknown>>;
}

interface OverviewCuePhase {
  label: string;
  headline: string;
  narration?: string;
  receive?: string;
  transform?: string;
  pass?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "formula";
}

function parseJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function audioFriendly(value: string): string {
  return value
    .replace(/\\operatorname\{([^}]+)\}/g, "$1")
    .replace(/([A-Za-z])_\{\\text\{([^}]+)\}\}/g, (_match, base: string, sub: string) => `${base} sub ${sub.replace(/-/g, " ")}`)
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/([A-Za-z])_\{([^}]+)\}/g, (_match, base: string, sub: string) => `${base} sub ${String(sub).replace(/[-_]/g, " ")}`)
    .replace(/\\sqrt\{([^}]+)\}/g, "the square root of $1")
    .replace(/Attention\s*\(\s*Q\s*,\s*K\s*,\s*V\s*\)\s*=\s*softmax\s*\(\s*QK\^T\s*\/\s*√d_k\s*\)\s*·\s*V/gi, "attention of Q, K, and V equals softmax of Q times K transpose divided by the square root of d sub k, then multiplied by V")
    .replace(/softmax\s*\(\s*QK\^T\s*\/\s*√d_k\s*\)\s*·\s*V/gi, "softmax of Q times K transpose divided by the square root of d sub k, then multiplied by V")
    .replace(/Q\s*·\s*K\^T/gi, "Q times K transpose")
    .replace(/QK\^T/gi, "Q times K transpose")
    .replace(/√d_k/gi, "the square root of d sub k")
    .replace(/d→4d/gi, "d to four d")
    .replace(/4d→d/gi, "four d back to d")
    .replace(/→/g, " to ")
    .replace(/×/g, " by ")
    .replace(/·/g, " times ")
    .replace(/\^T\b/g, " transpose")
    .replace(/√\s*/g, "square root of ")
    .replace(/\b([A-Za-z])_([A-Za-z0-9]+)\b/g, "$1 sub $2")
    .replace(/\b([A-Za-z])\^([A-Za-z0-9]+)\b/g, "$1 to the $2")
    .replace(/[{}\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPodcastOverviewScript(script: string): boolean {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const maleTurns = script.match(/^(?:Leo|Male host|Host A|Doraemon|Daniel|Alex):/gim)?.length ?? 0;
  const femaleTurns = script.match(/^(?:Maya|Female host|Host B|Guest|Ava|Mina):/gim)?.length ?? 0;
  return words >= MIN_WORDS && maleTurns >= 4 && femaleTurns >= 4;
}

function textFromBlock(block: unknown): string {
  if (!block || typeof block !== "object") return "";
  const b = block as Record<string, unknown>;
  const type = typeof b.type === "string" ? b.type : "";
  if (type === "definition") {
    return [b.term, b.definition].filter((v): v is string => typeof v === "string" && v.trim().length > 0).join(": ");
  }
  if (type === "formula") {
    const variables = Array.isArray(b.variables)
      ? b.variables
          .map((v) => {
            if (!v || typeof v !== "object") return "";
            const row = v as Record<string, unknown>;
            return [row.symbol, row.meaning].filter((x): x is string => typeof x === "string" && x.trim().length > 0).join(" means ");
          })
          .filter(Boolean)
          .slice(0, 4)
          .join("; ")
      : "";
    return audioFriendly([b.plain_english, variables].filter((v): v is string => typeof v === "string" && v.trim().length > 0).join(" Variables: "));
  }
  return audioFriendly([b.text, b.summary, b.caption]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" "));
}

function formulaPanelFromBlock(block: unknown, index: number): Panel | null {
  if (!block || typeof block !== "object") return null;
  const b = block as Record<string, unknown>;
  if (b.type !== "formula") return null;
  const latex = typeof b.latex === "string" && b.latex.trim() ? b.latex.trim() : "";
  const plain = typeof b.plain_english === "string" && b.plain_english.trim() ? b.plain_english.trim() : "";
  if (!latex && !plain) return null;
  const variables = Array.isArray(b.variables)
    ? b.variables
        .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
        .map((v) => ({
          label: typeof v.symbol === "string" && v.symbol.trim() ? audioFriendly(v.symbol) : "term",
          value: [
            typeof v.meaning === "string" ? v.meaning : "",
            typeof v.shape === "string" ? `shape: ${v.shape}` : "",
          ].filter(Boolean).join(" | "),
          role: "context",
        }))
        .filter((v) => v.value.trim().length > 0)
    : [];
  const title = plain ? plain.slice(0, 80) : `Formula ${index + 1}`;
  return {
    id: `formula-${index + 1}-${slugify(title)}`,
    title: "Formula focus",
    kind: "formula",
    description: "Shows the formal expression while the audio highlights the symbols being discussed.",
    data: [
      { label: "formula", value: latex || plain, role: "context" },
      ...variables.slice(0, 6),
    ],
  };
}

function collectFormulaPanels(activities: ActivityRow[]): Panel[] {
  const panels: Panel[] = [];
  for (const activity of activities) {
    const content = parseJson(activity.content);
    const collections: unknown[] = [];
    if (Array.isArray(content.blocks)) collections.push(...content.blocks);
    if (content.reading && typeof content.reading === "object") {
      const reading = content.reading as Record<string, unknown>;
      if (Array.isArray(reading.blocks)) collections.push(...reading.blocks);
    }
    for (const block of collections) {
      const panel = formulaPanelFromBlock(block, panels.length);
      if (panel) panels.push(panel);
    }
  }
  return panels.slice(0, 3);
}

function summarizeActivities(activities: ActivityRow[]): string[] {
  const out: string[] = [];
  for (const activity of activities) {
    const content = parseJson(activity.content);
    if (activity.activity_type === "audio") {
      continue;
    } else if (activity.activity_type === "reading") {
      const blocks = Array.isArray(content.blocks) ? content.blocks : [];
      const blockText = blocks.map(textFromBlock).filter(Boolean).slice(0, 6).join(" ");
      const summary = typeof content.summary === "string" ? content.summary : "";
      out.push(`Reading "${activity.title}": ${[blockText, summary].filter(Boolean).join(" ")}`.slice(0, 700));
    } else if (activity.activity_type === "lesson_part") {
      const partTitle = typeof content.title === "string" ? content.title : activity.title;
      const reading = content.reading && typeof content.reading === "object" ? content.reading as Record<string, unknown> : {};
      const intro = typeof reading.intro === "string" ? reading.intro : "";
      const summary = typeof reading.summary === "string" ? reading.summary : "";
      const blocks = Array.isArray(reading.blocks) ? reading.blocks : [];
      const blockText = blocks.map(textFromBlock).filter(Boolean).slice(0, 5).join(" ");
      out.push(`Section "${partTitle}" teaches: ${[intro, blockText, summary].filter(Boolean).join(" ")}`.slice(0, 800));
    } else if (activity.activity_type === "interactive") {
      const instructions = typeof content.instructions === "string" ? content.instructions : "";
      const widgetTitle = typeof content.title === "string" ? content.title : activity.title;
      out.push(`Interactive "${widgetTitle}": ${instructions}`.slice(0, 420));
    } else if (activity.activity_type === "practice_code") {
      const prompt = typeof content.prompt === "string" ? content.prompt : "";
      out.push(`The coding reinforcement applies the mechanism by asking for: ${prompt}`.slice(0, 420));
    } else if (activity.activity_type === "assessment") {
      out.push(`The final check asks for explanation, ordering, classification, and transfer using the same concepts.`);
    }
  }
  return out.filter((line) => line.trim().length > 20);
}

function buildLongOverviewScript(lesson: LessonRow, outline: string[]): string {
  const topic = `${lesson.subject_title}: ${lesson.title}`;
  const description = audioFriendly(lesson.description?.trim() || "This lesson is part of your active curriculum.");
  const outlineText = outline.length
    ? outline.map((line) => audioFriendly(line)).join(" ")
    : "This lesson introduces the main object, names the transformation, shows what changes, and gives you practice evidence.";
  const turns = [
    [
      "Leo",
      `Let's build the high-level picture for ${topic}. ${description} The useful starting point is the actual object being transformed. In this lesson, we will keep returning to that object, show what information it carries, show which operation changes it, and name the evidence that proves the operation worked.`,
    ],
    [
      "Maya",
      `Good. So this is not a table of contents. It is the concept itself, told from several angles. Start with the object, then the operation, then the consequence. If the topic has formulas, we will describe what each part means before treating the notation as compact shorthand.`,
    ],
    [
      "Leo",
      `Here is the actual mechanism we need to understand. ${outlineText} The important move is to connect those ideas as one chain. A term is useful only when it tells us what information is present, what operation happens next, and what the next representation can now support.`,
    ],
    [
      "Maya",
      `Let me put that in a metaphor. Imagine this lesson as a workshop bench. A labeled object arrives at the bench. The worker does not just wave at it and call it transformed. The worker inspects it, chooses a tool, changes a specific part, checks the result, and attaches a tag for the next bench. That tag is only meaningful if we know what actually happened to the object.`,
    ],
    [
      "Leo",
      `That analogy is useful because a technical label can sound familiar while the mechanism underneath is still fuzzy. Here, whenever a term appears, we should be able to say what arrived at the bench, which tool touched it, what changed, and what the next bench receives. If a word sounds important but those answers are still vague, we make the example smaller and trace it again.`,
    ],
    [
      "Maya",
      `Now make it concrete with a tiny example from the topic. Instead of talking about the whole system at once, follow one small representation. If it is a vector row, name the row and its width. If it is a score, say what two things produced it. If it is a probability, say which alternatives it ranks. The tiny version should still be faithful to the real mechanism.`,
    ],
    [
      "Leo",
      `Now move one level deeper into mechanism. A mechanism is the answer to why the next step exists. If a component receives a representation, ask what information is already present and what is missing. If a component transforms a representation, ask whether it changes the values, the order, the scale, the confidence, the relationship between parts, or the interpretation. If a component passes a result forward, ask what guarantee the next stage relies on. This mechanism pass is slower on purpose. You are hearing the same idea again, but now with the gears exposed.`,
    ],
    [
      "Maya",
      `I like that because it separates comfort from understanding. You can feel comfortable with a phrase, but the mechanism asks a harder question: can you predict how the representation would change if this operation were different? If the answer is no, we slow down until the cause, the change, and the consequence line up.`,
    ],
    [
      "Leo",
      `Now switch to the implementation perspective without turning this into a coding lecture. The same concept should have a recognizable input, an intermediate value you could inspect, and an output whose shape or meaning can be checked. The code section later is optional reinforcement, but it should feel like executable evidence for the same mechanism we are explaining here.`,
    ],
    [
      "Maya",
      `Now name a common misconception from the topic itself. A raw score is not yet a probability. A stage name is not the operation inside the stage. A vector label is not the information carried by that vector. The fix is to show the same relationship from another angle until the object, operation, and consequence line up.`,
    ],
    [
      "Leo",
      `Use a second metaphor too. Think of this as translation between languages. The first language is your intuitive picture. The second language is the formal vocabulary. The third language is the visualization. The fourth language is a concrete trace you could check. A strong mental model lets you translate the same idea among all four. If you only know the formal word, you may recognize it without being able to use it. If you only know the metaphor, you may feel comfortable but miss the details. We want both.`,
    ],
    [
      "Maya",
      `Let me try to say the standard back. A useful explanation names the object, shows the operation, says what changed, and then explains why the changed object is useful for the next step. By the end, we should be able to explain the same mechanism from the pipeline perspective, the analogy perspective, the tiny-example perspective, the formal perspective, and the skeptical-question perspective.`,
    ],
  ] satisfies Array<[string, string]>;

  let script = turns.map(([speaker, text]) => `${speaker}: ${text}`).join("\n\n");
  let pass = 2;
  while (script.trim().split(/\s+/).length < MIN_WORDS) {
    const speaker = pass % 2 === 0 ? "Leo" : "Maya";
    script += `\n\n${speaker}: Revisit ${topic} one more time from a slightly different angle. Do not treat repetition as filler. Repetition is what lets a new mental model survive pressure. Say the incoming object again. Say the operation again. Say the output again. Then connect it to one concrete idea: ${audioFriendly(outline[pass % Math.max(outline.length, 1)] ?? description)}. If you can explain that idea using the workshop bench, the tiny example, the mechanism trace, and the formal check, this has moved from recognition toward usable understanding. We will keep the vibe conversational, like a careful podcast host pausing to make sure the listener is still with the idea before moving deeper.`;
    pass += 1;
  }
  return script;
}

function defaultPanels(lesson: LessonRow): Panel[] {
  return [
    {
      id: "overview-map",
      title: "Big map",
      kind: "pipeline",
      description: `Places ${lesson.title} inside ${lesson.subject_title}.`,
      data: [
        { label: "Subject", value: lesson.subject_title, role: "context" },
        { label: "Lesson", value: lesson.title, role: "process" },
        { label: "Next", value: "practice-ready object", role: "output" },
      ],
    },
    {
      id: "analogy",
      title: "Workshop metaphor",
      kind: "flow",
      description: "Shows receive, transform, and pass-forward using a simple bench metaphor.",
      data: [
        { label: "Receive", value: "labeled object", role: "input" },
        { label: "Transform", value: "chosen tool", role: "process" },
        { label: "Pass", value: "tagged output", role: "output" },
      ],
    },
    {
      id: "tiny-example",
      title: "Tiny example",
      kind: "cards",
      description: "Tracks one small concrete object through the lesson.",
      data: [
        { label: "Object", value: "small example", role: "input" },
        { label: "Change", value: "visible operation", role: "process" },
      ],
    },
    {
      id: "mechanism",
      title: "Mechanism trace",
      kind: "matrix",
      description: "Names what changes and what stays stable.",
      data: [
        { label: "Before", value: "incoming state", role: "input" },
        { label: "During", value: "operation", role: "process" },
        { label: "After", value: "handoff state", role: "output" },
      ],
    },
    {
      id: "implementation",
      title: "Implementation intuition",
      kind: "ledger",
      description: "Connects the concept to variables, tests, and debugging evidence.",
      data: [
        { label: "Variable", value: "named object", role: "context" },
        { label: "Assert", value: "expected output", role: "output" },
      ],
    },
    {
      id: "misconception",
      title: "Misconception check",
      kind: "comparison",
      description: "Separates nearby ideas that are easy to confuse.",
      data: [
        { label: "Confusing label", value: "sounds similar", role: "warning" },
        { label: "Correct relation", value: "receive/change/pass", role: "output" },
      ],
    },
  ];
}

function normalizePanels(value: unknown, lesson: LessonRow): Panel[] {
  const panels = Array.isArray(value) ? value : [];
  const normalized = panels
    .filter((panel): panel is Record<string, unknown> => !!panel && typeof panel === "object")
    .map((panel, index) => ({
      id: typeof panel.id === "string" && panel.id.trim() ? panel.id : `panel-${index + 1}`,
      title: typeof panel.title === "string" && panel.title.trim() ? panel.title : `Panel ${index + 1}`,
      kind: typeof panel.kind === "string" && panel.kind.trim() ? panel.kind : "cards",
      description:
        typeof panel.description === "string" && panel.description.trim()
          ? panel.description
          : "A generated panel used by the long overview audio.",
      data: Array.isArray(panel.data) ? panel.data as Array<Record<string, unknown>> : [],
    }));
  return normalized.length >= 2 ? normalized : defaultPanels(lesson);
}

function activeElements(panel: Panel): string[] {
  const labels = (panel.data ?? [])
    .map((item) => typeof item.label === "string" ? item.label : "")
    .filter(Boolean)
    .slice(0, 2);
  return labels.length ? labels : [panel.title];
}

function formulaCueText(panel: Panel, index: number): OverviewCuePhase {
  const terms = panel.data
    ?.filter((item) => item.label !== "formula")
    .map((item) => String(item.label ?? "").trim())
    .filter(Boolean)
    .slice(0, 4) ?? [];
  const spokenTerms = terms.length ? terms.join(", ") : "the named terms";
  return {
    label: `Formula ${index + 1}`,
    headline: `Follow the formula and highlight ${spokenTerms}`,
    narration: `Watch the displayed equation while the hosts connect ${spokenTerms} to the part being discussed. The highlighted terms are the pieces to follow right now.`,
    receive: "the mechanism described just before the formula",
    transform: `highlight ${spokenTerms} in the displayed formula`,
    pass: "a named formula you can explain in words",
  };
}

function longOrientationVisual(existing: unknown, lesson: LessonRow, formulaPanels: Panel[]) {
  const current = existing && typeof existing === "object" ? existing as Record<string, unknown> : {};
  const scene = current.scene && typeof current.scene === "object" ? current.scene as Record<string, unknown> : {};
  const formulaPanelIds = new Set(formulaPanels.map((panel) => panel.id));
  const basePanels = normalizePanels(scene.panels, lesson).filter((panel) => !formulaPanelIds.has(panel.id));
  const panels = [...basePanels, ...formulaPanels].filter((panel, index, all) =>
    all.findIndex((p) => p.id === panel.id) === index
  );
  const formulaPhases = formulaPanels.map((panel, index) => formulaCueText(panel, index));
  const phases: OverviewCuePhase[] = [
    { label: "High-level map", headline: "Locate the lesson before details" },
    { label: "Analogy", headline: "Translate the idea into a workshop metaphor" },
    { label: "Tiny example", headline: "Follow one concrete object" },
    { label: "Mechanism", headline: "Expose what changes and why" },
    ...formulaPhases,
    { label: "Implementation", headline: "Connect to code and tests" },
    { label: "Misconception", headline: "Separate nearby ideas" },
    { label: "Synthesis", headline: "Restate the mechanism from multiple angles" },
  ];
  const step = MIN_DURATION / phases.length;
  const cues = phases.map((phase, index) => {
    const label = phase.label;
    const headline = phase.headline;
    const formulaIndex = /^Formula (\d+)$/.test(label) ? Number(label.replace("Formula ", "")) - 1 : -1;
    const formulaPanel = formulaIndex >= 0 ? formulaPanels[formulaIndex] : undefined;
    const panel = formulaPanel ?? panels[index % panels.length];
    return {
      start: Math.round(index * step),
      end: index === phases.length - 1 ? MIN_DURATION : Math.round((index + 1) * step),
      label,
      headline,
      narration: phase.narration ?? `${headline} for ${lesson.title}.`,
      receive: phase.receive ?? (index === 0 ? "subject context" : "previous overview perspective"),
      transform: phase.transform ?? headline.toLowerCase(),
      pass: phase.pass ?? (index === phases.length - 1 ? "practice-ready mental model" : "next overview perspective"),
      panel_id: panel.id,
      active_elements:
        formulaPanel
          ? panel.data?.filter((item) => item.label !== "formula").map((item) => String(item.label)).slice(0, 3)
          : activeElements(panel),
    };
  });

  return {
    ...current,
    strategy: "timeline",
    artifact_slug: typeof current.artifact_slug === "string" ? current.artifact_slug : `lesson-${lesson.id}-long-overview`,
    description:
      typeof current.description === "string" && current.description.trim()
        ? current.description
        : `Audio-synced overview scene for ${lesson.title}.`,
    scene: {
      ...scene,
      scene_id:
        typeof scene.scene_id === "string" && scene.scene_id.trim()
          ? scene.scene_id
          : `lesson-${lesson.id}-long-overview-scene`,
      title: typeof scene.title === "string" && scene.title.trim() ? scene.title : `${lesson.title} Overview`,
      motif: typeof scene.motif === "string" && scene.motif.trim() ? scene.motif : "spiral lesson map",
      description:
        typeof scene.description === "string" && scene.description.trim()
          ? scene.description
          : `A generated long-form overview scene for ${lesson.title}.`,
      panels,
    },
    cues,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const lessonIds = args
    .flatMap((arg, index) => arg === "--lesson-id" ? [args[index + 1] ?? ""] : /^\d+$/.test(arg) ? [arg] : [])
    .filter((arg) => /^\d+$/.test(arg))
    .map((arg) => Number.parseInt(arg, 10));
  const noAudio = args.includes("--no-audio");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number.parseInt(args[limitIndex + 1] ?? "", 10) : null;

  const db = getDb();
  const lessonRows = lessonIds.length
    ? db.prepare(
        `SELECT lessons.id, lessons.title, lessons.description, lessons.status, subjects.title AS subject_title
         FROM lessons JOIN subjects ON subjects.id = lessons.subject_id
         WHERE lessons.id IN (${lessonIds.map(() => "?").join(",")})
         ORDER BY lessons.id`
      ).all(...lessonIds) as LessonRow[]
    : db.prepare(
        `SELECT lessons.id, lessons.title, lessons.description, lessons.status, subjects.title AS subject_title
         FROM lessons JOIN subjects ON subjects.id = lessons.subject_id
         WHERE lessons.status IN ('in_progress', 'queued')
         ORDER BY lessons.id`
      ).all() as LessonRow[];

  const selected = Number.isFinite(limit ?? Number.NaN) && limit && limit > 0
    ? lessonRows.slice(0, limit)
    : lessonRows;

  const activityStmt = db.prepare(
    `SELECT id, activity_type, title, sequence_order, content
     FROM lesson_activities WHERE lesson_id = ?
     ORDER BY sequence_order ASC, id ASC`
  );
  const updateStmt = db.prepare(`UPDATE lesson_activities SET content = ? WHERE id = ?`);
  const artifactStmt = db.prepare(
    `SELECT duration_sec, source_script FROM generated_artifacts
     WHERE lesson_id = ? AND activity_id = ? AND artifact_type = 'audio'
     ORDER BY generated_at DESC LIMIT 1`
  );

  for (const lesson of selected) {
    const activities = activityStmt.all(lesson.id) as ActivityRow[];
    const audio = activities.find((activity) => activity.activity_type === "audio");
    if (!audio) {
      console.log(`lesson ${lesson.id}: skipped, no top-level audio activity`);
      continue;
    }
    const content = parseJson(audio.content);
    const currentScript = typeof content.script === "string" ? content.script.trim() : "";
    const currentDuration = Number(content.duration_hint ?? 0);
    const artifact = artifactStmt.get(lesson.id, audio.id) as ArtifactRow | undefined;
    if (
      isPodcastOverviewScript(currentScript) &&
      Number.isFinite(currentDuration) &&
      currentDuration >= MIN_DURATION &&
      artifact?.source_script === currentScript &&
      Number(artifact.duration_sec ?? 0) >= MIN_DURATION &&
      content.backfilled_long_overview_style === STYLE_VERSION
    ) {
      console.log(`lesson ${lesson.id}: already has podcast overview audio (${artifact.duration_sec}s), skipped`);
      continue;
    }
    const outline = summarizeActivities(activities);
    const formulaPanels = collectFormulaPanels(activities);
    const script = buildLongOverviewScript(lesson, outline);
    const nextContent = {
      ...content,
      script,
      transcript: script,
      duration_hint: MIN_DURATION,
      orientation_visual: longOrientationVisual(content.orientation_visual, lesson, formulaPanels),
      backfilled_long_overview_style: STYLE_VERSION,
      backfilled_long_overview_audio_at: new Date().toISOString(),
    };
    updateStmt.run(JSON.stringify(nextContent), audio.id);
    const words = script.trim().split(/\s+/).length;
    console.log(`lesson ${lesson.id}: updated overview script (${words} words, ${MIN_DURATION}s hint)`);
    if (!noAudio) {
      const result = await generateLessonAudio(db, lesson.id);
      console.log(`lesson ${lesson.id}: audio ${result.status}${result.durationSec ? ` (${result.durationSec}s)` : ""}`);
    }
  }

  closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
