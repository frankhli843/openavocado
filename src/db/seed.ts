/**
 * Synthetic seed data for development.
 * Uses clearly fictional learner profiles. No personal data committed.
 */
import { getDb } from "./connection";

export function seedDatabase(): void {
  const db = getDb();

  const existing = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
  if (existing.n > 0) return; // already seeded

  // Synthetic user
  const userResult = db
    .prepare(
      "INSERT INTO users (username, display_name, email) VALUES (?, ?, ?)"
    )
    .run("alex_learner", "Alex Learner", "alex@example.local");
  const userId = userResult.lastInsertRowid as number;

  // Learner profile
  const profileResult = db
    .prepare(
      "INSERT INTO learner_profiles (user_id, display_name, bio, preferred_lang) VALUES (?, ?, ?, ?)"
    )
    .run(
      userId,
      "Alex",
      "Synthetic learner profile for local development. Not a real person.",
      "en"
    );
  const learnerId = profileResult.lastInsertRowid as number;

  // Subjects
  const mathId = (
    db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, current_level) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        learnerId,
        "Applied Probability & Statistics",
        "Understanding probability theory, Bayesian inference, and statistical analysis through practical models.",
        "Reach competence-level understanding of Bayesian inference and apply it to real datasets using Python.",
        "familiarity"
      )
  ).lastInsertRowid as number;

  const econId = (
    db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, current_level) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        learnerId,
        "Microeconomics",
        "Understanding market forces, incentives, and decision-making under constraints.",
        "Model economic concepts in Python: supply/demand curves, utility functions, game theory payoff matrices.",
        "familiarity"
      )
  ).lastInsertRowid as number;

  // Diagnostics for math subject
  db.prepare(
    "INSERT INTO diagnostics (subject_id, question, answer, completed_at) VALUES (?, ?, ?, ?)"
  ).run(
    mathId,
    "What is your current comfort level with probability? (none / some / comfortable / strong)",
    "some",
    new Date().toISOString()
  );
  db.prepare(
    "INSERT INTO diagnostics (subject_id, question, answer, completed_at) VALUES (?, ?, ?, ?)"
  ).run(
    mathId,
    "Have you used Python for data analysis before? (never / a little / regularly)",
    "a little",
    new Date().toISOString()
  );

  // Tags
  const conceptTagId = (db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, ?) RETURNING id").get("conditional-probability", "concept") as { id: number })?.id ||
    (db.prepare("SELECT id FROM tags WHERE name = ?").get("conditional-probability") as { id: number }).id;
  const bayesTagId = (db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, ?) RETURNING id").get("bayes-theorem", "concept") as { id: number })?.id ||
    (db.prepare("SELECT id FROM tags WHERE name = ?").get("bayes-theorem") as { id: number }).id;
  const supplyTagId = (db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, ?) RETURNING id").get("supply-demand", "curriculum_area") as { id: number })?.id ||
    (db.prepare("SELECT id FROM tags WHERE name = ?").get("supply-demand") as { id: number }).id;

  // Lesson 1 — Probability foundations
  const lesson1Id = (
    db
      .prepare(
        `INSERT INTO lessons (subject_id, title, description, status, sequence_number, goals, tags, generated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mathId,
        "Introduction to Conditional Probability",
        "Explore what conditional probability means, why it matters, and how to calculate it using Python.",
        "completed",
        1,
        JSON.stringify(["Understand P(A|B)", "Calculate conditional probabilities from frequency data", "Recognize common misconceptions"]),
        JSON.stringify(["conditional-probability", "foundations"]),
        "doramon-lesson-generator/v1"
      )
  ).lastInsertRowid as number;

  db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)").run(lesson1Id, conceptTagId);

  // Core activities for lesson 1
  const audioId = (db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'audio', 1, 1, ?, ?)`
  ).run(
    lesson1Id,
    "Audio: Conditional Probability",
    JSON.stringify({
      script: "Conditional probability is the probability of an event given that another event has occurred...",
      duration_hint: 600,
    })
  )).lastInsertRowid as number;

  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'interactive', 1, 2, ?, ?)`
  ).run(
    lesson1Id,
    "Bayes' Theorem: The Base-Rate Trap",
    JSON.stringify({
      schema_version: "1.0",
      widget_type: "declarative",
      title: "Bayes' Theorem: The Base-Rate Trap",
      instructions:
        "A positive medical test feels alarming, but the chance you actually have the disease depends on how rare it is. Adjust the disease prevalence and the test's sensitivity and specificity, then watch how P(disease | positive) changes.",
      controls: [
        { type: "slider", id: "prior", label: "Disease prevalence (prior)", min: 0.001, max: 0.2, step: 0.001, default: 0.01, format: "percent" },
        { type: "slider", id: "sensitivity", label: "Test sensitivity  P(+ | disease)", min: 0.5, max: 1, step: 0.01, default: 0.95, format: "percent" },
        { type: "slider", id: "specificity", label: "Test specificity  P(- | healthy)", min: 0.5, max: 1, step: 0.01, default: 0.9, format: "percent" },
      ],
      outputs: [
        { id: "prior_p", label: "Prior P(disease)", formula: "prior", format: "percent", precision: 2 },
        {
          id: "posterior",
          label: "P(disease | positive)",
          formula: "(prior*sensitivity)/((prior*sensitivity)+((1-prior)*(1-specificity)))",
          format: "percent",
          precision: 1,
        },
        { id: "false_alarm", label: "False-positive rate", formula: "1 - specificity", format: "percent", precision: 1 },
      ],
      chart: {
        type: "bar",
        title: "Probability of disease: before vs. after a positive test",
        bars: [
          { label: "Prior", ref: "prior_p", color: "#94a3b8" },
          { label: "After +test", ref: "posterior", color: "#2563eb" },
        ],
      },
      panels: [
        {
          title: "Why is it so low?",
          template:
            "Even with a {{sensitivity}} sensitive test, a positive result implies only about {{posterior}} chance of disease when the condition is rare ({{prior_p}} prior). Most positives are false alarms drawn from the large healthy population — the base-rate fallacy.",
        },
      ],
    })
  );

  const codeId = (db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'practice_code', 1, 3, ?, ?)`
  ).run(
    lesson1Id,
    "Python: Calculate Conditional Probabilities",
    JSON.stringify({
      language: "python",
      starter_code: `# Conditional Probability Exercise
# You have a dataset of 1000 people.
# 400 are smokers, 100 have lung disease, 80 are both smokers with lung disease.
smokers = 400
lung_disease = 100
both = 80
total = 1000

# Q1: What is P(lung disease | smoker)?
# p_lung_given_smoker = ?

# Q2: What is P(smoker | lung disease)?
# p_smoker_given_lung = ?

# Q3: Are smoking and lung disease independent?
# (Hint: check if P(A|B) == P(A))
`,
      tests: [
        {
          id: "t1",
          description: "P(lung disease | smoker) should be ~0.20",
          assert: "abs(p_lung_given_smoker - 0.2) < 0.001",
        },
        {
          id: "t2",
          description: "P(smoker | lung disease) should be 0.8",
          assert: "abs(p_smoker_given_lung - 0.8) < 0.001",
        },
      ],
    })
  )).lastInsertRowid as number;

  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'assessment', 1, 4, ?, ?)`
  ).run(
    lesson1Id,
    "Assessment: Conditional Probability Understanding",
    JSON.stringify({
      questions: [
        {
          id: "q1",
          text: "Explain in your own words: how does conditioning change the sample space?",
          type: "free_text",
        },
        {
          id: "q2",
          text: "A medical test is 95% sensitive (true positive rate) and 90% specific. If 1% of the population has the disease, what is P(disease | positive test)?",
          type: "numeric",
          hint: "Use Bayes' theorem",
        },
        {
          id: "q3",
          text: "What is the key difference between P(A|B) and P(B|A)?",
          type: "free_text",
        },
      ],
    })
  );

  // Autosave a completed state for lesson 1 (activity_id=codeId scoped to the code activity)
  db.prepare(
    `INSERT OR REPLACE INTO lesson_autosave (lesson_id, learner_id, activity_id, code_draft, run_output, test_results, assessment_answers, last_edited_at, last_run_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    lesson1Id,
    learnerId,
    codeId,
    `smokers = 400\nlung_disease = 100\nboth = 80\ntotal = 1000\np_lung_given_smoker = both / smokers\np_smoker_given_lung = both / lung_disease\nprint(p_lung_given_smoker, p_smoker_given_lung)`,
    "0.2 0.8",
    JSON.stringify({ t1: "pass", t2: "pass" }),
    JSON.stringify({ q1: "Conditioning restricts the sample space to only outcomes where B occurred.", q2: "~0.0876", q3: "Order matters: P(A|B) uses B as the given, P(B|A) uses A." }),
    new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    new Date(Date.now() - 1000 * 60 * 25).toISOString()
  );

  // Mastery signals from lesson 1
  db.prepare(
    "INSERT INTO mastery_signals (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(learnerId, mathId, lesson1Id, "strength", "conditional-probability", "Correctly computed P(A|B) and P(B|A)", 0.75);
  db.prepare(
    "INSERT INTO mastery_signals (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(learnerId, mathId, lesson1Id, "review_needed", "bayes-theorem", "Bayes' theorem application needs reinforcement", 0.4);

  // Progress points from lesson 1
  const now = new Date();
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getTime() - (5 - i) * 7 * 24 * 60 * 60 * 1000);
    db.prepare(
      "INSERT INTO progress_points (learner_id, subject_id, lesson_id, metric, value, recorded_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(learnerId, mathId, lesson1Id, "mastery", 20 + i * 10, d.toISOString());
    db.prepare(
      "INSERT INTO progress_points (learner_id, subject_id, lesson_id, metric, value, recorded_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(learnerId, mathId, lesson1Id, "assessment_score", 60 + i * 8, d.toISOString());
  }

  // Generated artifact (audio metadata) for lesson 1 — file itself not committed
  db.prepare(
    `INSERT INTO generated_artifacts (lesson_id, activity_id, artifact_type, provider, voice, duration_sec, content_hash, file_path, source_script, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    lesson1Id,
    audioId,
    "audio",
    "openai-tts",
    "alloy",
    612.5,
    "sha256:abc123def456",
    "runtime_artifacts/audio/lesson_1_audio.mp3",
    "Conditional probability is the probability of an event given that another event has occurred...",
    new Date().toISOString()
  );

  // Lesson 2 — Bayes (queued)
  const lesson2Id = (
    db
      .prepare(
        `INSERT INTO lessons (subject_id, title, description, status, sequence_number, goals, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mathId,
        "Bayes' Theorem in Practice",
        "Apply Bayes' theorem to realistic diagnostic and classification problems.",
        "queued",
        2,
        JSON.stringify(["Derive Bayes' theorem from conditional probability", "Apply to medical diagnosis and spam filtering", "Implement naive Bayes classifier in Python"]),
        JSON.stringify(["bayes-theorem", "classification"])
      )
  ).lastInsertRowid as number;

  if (bayesTagId) db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)").run(lesson2Id, bayesTagId);

  // Lesson for econ subject
  const econLesson1Id = (
    db
      .prepare(
        `INSERT INTO lessons (subject_id, title, description, status, sequence_number, goals, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        econId,
        "Supply, Demand, and Equilibrium",
        "Model market equilibrium using Python. Build supply and demand curves as classes.",
        "queued",
        1,
        JSON.stringify(["Understand supply/demand mechanics", "Model equilibrium computationally", "Identify price elasticity"]),
        JSON.stringify(["supply-demand", "market-equilibrium"])
      )
  ).lastInsertRowid as number;

  if (supplyTagId) db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)").run(econLesson1Id, supplyTagId);

  // Core activities for the econ lesson — demonstrates the supply-demand widget.
  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'audio', 1, 1, ?, ?)`
  ).run(
    econLesson1Id,
    "Audio: How Markets Find a Price",
    JSON.stringify({
      script:
        "A market price is not set by anyone in particular. It emerges where the quantity buyers want equals the quantity sellers offer...",
      duration_hint: 540,
    })
  );

  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'interactive', 1, 2, ?, ?)`
  ).run(
    econLesson1Id,
    "Market Equilibrium Simulator",
    JSON.stringify({
      schema_version: "1.0",
      widget_type: "supply-demand",
      title: "Market Equilibrium Simulator",
      instructions:
        "Shift the supply and demand curves or add a per-unit tax, and watch the equilibrium price and quantity move. The black dot marks where supply meets demand.",
      params: { demandIntercept: 100, demandSlope: 1.5, supplyIntercept: 0, supplySlope: 2, priceMax: 60 },
    })
  );

  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'practice_code', 1, 3, ?, ?)`
  ).run(
    econLesson1Id,
    "Python: Solve for Market Equilibrium",
    JSON.stringify({
      language: "python",
      starter_code: `# Demand:  Qd = 100 - 1.5 * P
# Supply:  Qs = 2 * P
# Find the equilibrium price P where Qd == Qs, then the quantity.

# p_star = ?
# q_star = ?
`,
      tests: [
        { id: "t1", description: "Equilibrium price ~ 28.57", assert: "abs(p_star - (100 / 3.5)) < 0.01" },
        { id: "t2", description: "Equilibrium quantity ~ 57.14", assert: "abs(q_star - (2 * (100 / 3.5))) < 0.01" },
      ],
    })
  );

  db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, 'assessment', 1, 4, ?, ?)`
  ).run(
    econLesson1Id,
    "Assessment: Supply, Demand, and Taxes",
    JSON.stringify({
      questions: [
        { id: "q1", text: "In your own words, what does the equilibrium price represent?", type: "free_text" },
        { id: "q2", text: "If a per-unit tax is added, what happens to the price buyers pay and the quantity traded? Why?", type: "free_text" },
        { id: "q3", text: "Who bears more of a tax when demand is very inelastic (steep): buyers or sellers?", type: "free_text" },
      ],
    })
  );

  // Next lesson job (queued after lesson 1 completion)
  db.prepare(
    `INSERT INTO next_lesson_jobs (subject_id, completed_lesson_id, adapter, status, payload)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    mathId,
    lesson1Id,
    "noop",
    "completed",
    JSON.stringify({
      event: "lesson.completed",
      lesson_id: lesson1Id,
      lesson_title: "Introduction to Conditional Probability",
      subject_id: mathId,
      subject_title: "Applied Probability & Statistics",
      learner_id: learnerId,
    })
  );

  console.log("Seed data applied: synthetic user alex_learner with 2 subjects and sample lessons.");
}
