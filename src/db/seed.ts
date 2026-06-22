/**
 * Synthetic seed data for development.
 * Uses clearly fictional learner profiles. No personal data committed.
 *
 * The seeded lessons demonstrate the full lesson-content framework: audio,
 * first-class written text, safe embedded media, MULTIPLE visualization
 * perspectives for the same concept, and a scaffolded code exercise with
 * hints and hidden tests (no exposed answer).
 */
import { getDb } from "./connection";

export function seedDatabase(): void {
  const db = getDb();

  const existing = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
  if (existing.n > 0) return; // already seeded

  // Synthetic user
  const userResult = db
    .prepare("INSERT INTO users (username, display_name, email) VALUES (?, ?, ?)")
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
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        learnerId,
        "Applied Probability & Statistics",
        "Understanding probability theory, Bayesian inference, and statistical analysis through practical models.",
        "Reach competence-level understanding of Bayesian inference and apply it to real datasets using Python.",
        "Focus on building intuition through simulation first, then formal notation. Include Python code exercises that implement the models from scratch. I find rote formula derivations less useful than understanding the mechanics through examples. Prefer lessons that connect back to real-world decision-making contexts rather than purely abstract math.",
        "familiarity"
      )
  ).lastInsertRowid as number;

  const econId = (
    db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        learnerId,
        "Microeconomics",
        "Understanding market forces, incentives, and decision-making under constraints.",
        "Model economic concepts in Python: supply/demand curves, utility functions, game theory payoff matrices.",
        "Prefer applied examples over pure theory. Use Python simulations to make abstract concepts concrete — build the supply/demand model, run the game, see the equilibrium. Keep math notation concise and always explain what each variable means in plain English before using it in a formula.",
        "familiarity"
      )
  ).lastInsertRowid as number;

  // An archived subject so the archive/recover view has content out of the box.
  const archivedId = (
    db
      .prepare(
        `INSERT INTO subjects (learner_id, title, description, goals, criteria, current_level, status, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, 'archived', datetime('now', '-9 days'))`
      )
      .run(
        learnerId,
        "Intro to Calculus",
        "Limits, derivatives, and integrals — paused to focus on probability first.",
        "Build intuition for rates of change and accumulation, then model them in Python.",
        "Visual-first approach preferred. Use geometric intuitions before formal epsilon-delta definitions. Python plots and animations help a lot.",
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
  const conceptTagId =
    (db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, ?) RETURNING id").get("conditional-probability", "concept") as { id: number })?.id ||
    (db.prepare("SELECT id FROM tags WHERE name = ?").get("conditional-probability") as { id: number }).id;
  const bayesTagId =
    (db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, ?) RETURNING id").get("bayes-theorem", "concept") as { id: number })?.id ||
    (db.prepare("SELECT id FROM tags WHERE name = ?").get("bayes-theorem") as { id: number }).id;
  const supplyTagId =
    (db.prepare("INSERT OR IGNORE INTO tags (name, tag_type) VALUES (?, ?) RETURNING id").get("supply-demand", "curriculum_area") as { id: number })?.id ||
    (db.prepare("SELECT id FROM tags WHERE name = ?").get("supply-demand") as { id: number }).id;

  const insertActivity = db.prepare(
    `INSERT INTO lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  // ─── Lesson 1 — Conditional Probability (completed) ───────────────────────
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

  const audioId = (
    insertActivity.run(
      lesson1Id,
      "audio",
      1,
      1,
      "Audio: Conditional Probability",
      JSON.stringify({
        script: "Conditional probability is the probability of an event given that another event has occurred. We narrow the world down to the cases where the condition holds, then ask how often our event of interest happens inside that smaller world.",
        duration_hint: 600,
      })
    )
  ).lastInsertRowid as number;

  insertActivity.run(
    lesson1Id,
    "reading",
    1,
    2,
    "Read: What Conditioning Really Does",
    JSON.stringify({
      intro: "Conditional probability is one idea expressed in one formula, but the intuition matters more than the symbols.",
      blocks: [
        { type: "heading", text: "Narrowing the sample space" },
        { type: "paragraph", text: "When we write P(A | B), we are no longer asking about the whole population. We restrict attention to the cases where B is true, and ask: within that group, how often is A also true?" },
        { type: "definition", term: "Conditional probability", definition: "P(A | B) = P(A and B) / P(B). The probability of A within the subgroup where B already holds." },
        { type: "example", title: "Worked example", body: "Out of 1,000 people, 400 smoke and 80 of those smokers have lung disease. Then P(lung disease | smoker) = 80 / 400 = 0.20. We only counted smokers." },
        { type: "callout", tone: "warning", text: "P(A | B) and P(B | A) are usually different numbers. Reversing the condition reverses the denominator." },
        { type: "list", ordered: true, items: ["Find the group the condition selects (B).", "Count how many of that group also satisfy A.", "Divide: that ratio is P(A | B)."] },
      ],
      summary: "Conditioning shrinks the world to the cases where B is true, then measures A inside that smaller world. Always check which event is the condition.",
    })
  );

  insertActivity.run(
    lesson1Id,
    "media",
    0,
    3,
    "Watch: Conditional Probability Intuition",
    JSON.stringify({
      embeds: [
        {
          provider: "youtube",
          video_id: "ibINrxJLvlM",
          title: "Conditional probability, explained visually",
          reason: "A short visual walkthrough of how conditioning reshapes the sample space.",
          fallback_text: "If the video does not load, the same idea is covered in the written section above: conditioning restricts the population to the group where the condition holds.",
        },
      ],
    })
  );

  insertActivity.run(
    lesson1Id,
    "interactive",
    1,
    4,
    "Bayes' Theorem: The Base-Rate Trap",
    JSON.stringify(BAYES_BASE_RATE_WIDGET)
  );

  const codeId = (
    insertActivity.run(
      lesson1Id,
      "practice_code",
      1,
      5,
      "Python: Calculate Conditional Probabilities",
      JSON.stringify({
        language: "python",
        prompt: "Using the counts below, compute two conditional probabilities and assign them to the named variables.",
        constraints: ["Use the provided counts; do not hardcode the final ratios.", "Keep results as plain floats."],
        guided_steps: [
          "P(lung disease | smoker) divides the overlap (both) by the number of smokers.",
          "P(smoker | lung disease) divides the same overlap by the number with lung disease.",
        ],
        hints: [
          { level: 1, text: "Conditioning means dividing by the size of the group you are conditioning on." },
          { level: 2, text: "Both probabilities share the same numerator (people who are both)." },
          { level: 3, text: "p_lung_given_smoker = both / smokers" },
        ],
        starter_code: `# Conditional Probability Exercise
# 1000 people: 400 smokers, 100 with lung disease, 80 are both.
smokers = 400
lung_disease = 100
both = 80
total = 1000

# Q1: P(lung disease | smoker)
# p_lung_given_smoker = ?

# Q2: P(smoker | lung disease)
# p_smoker_given_lung = ?
`,
        tests: [
          { id: "t1", description: "P(lung disease | smoker) should be ~0.20", assert: "abs(p_lung_given_smoker - 0.2) < 0.001" },
          { id: "t2", description: "P(smoker | lung disease) should be 0.8", assert: "abs(p_smoker_given_lung - 0.8) < 0.001" },
        ],
        hidden_tests: [
          { id: "h1", description: "Probabilities are plain floats in [0, 1]", assert: "0 <= p_lung_given_smoker <= 1 and 0 <= p_smoker_given_lung <= 1" },
        ],
      })
    )
  ).lastInsertRowid as number;

  insertActivity.run(
    lesson1Id,
    "assessment",
    1,
    6,
    "Assessment: Conditional Probability Understanding",
    JSON.stringify({
      questions: [
        { id: "q1", text: "Explain in your own words: how does conditioning change the sample space?", type: "free_text" },
        { id: "q2", text: "A medical test is 95% sensitive and 90% specific. If 1% of the population has the disease, what is P(disease | positive test)?", type: "numeric", hint: "Use Bayes' theorem" },
        { id: "q3", text: "What is the key difference between P(A|B) and P(B|A)?", type: "free_text" },
      ],
    })
  );

  // Autosaved completed state for lesson 1 (learner's own past work on a finished lesson).
  db.prepare(
    `INSERT OR REPLACE INTO lesson_autosave (lesson_id, learner_id, activity_id, code_draft, run_output, test_results, assessment_answers, last_edited_at, last_run_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    lesson1Id,
    learnerId,
    codeId,
    `smokers = 400\nlung_disease = 100\nboth = 80\ntotal = 1000\np_lung_given_smoker = both / smokers\np_smoker_given_lung = both / lung_disease\nprint(p_lung_given_smoker, p_smoker_given_lung)`,
    "0.2 0.8",
    JSON.stringify({ t1: "pass", t2: "pass", h1: "pass" }),
    JSON.stringify({ q1: "Conditioning restricts the sample space to only outcomes where B occurred.", q2: "~0.0876", q3: "Order matters: P(A|B) uses B as the given, P(B|A) uses A." }),
    new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    new Date(Date.now() - 1000 * 60 * 25).toISOString()
  );

  // Mastery signals + progress for lesson 1
  db.prepare(
    "INSERT INTO mastery_signals (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(learnerId, mathId, lesson1Id, "strength", "conditional-probability", "Correctly computed P(A|B) and P(B|A)", 0.75);
  db.prepare(
    "INSERT INTO mastery_signals (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(learnerId, mathId, lesson1Id, "review_needed", "bayes-theorem", "Bayes' theorem application needs reinforcement", 0.4);

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

  // Audio artifact metadata for lesson 1 (file itself not committed)
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

  // ─── Lesson 2 — Bayes' Theorem in Practice (flagship, queued) ─────────────
  const lesson2Id = (
    db
      .prepare(
        `INSERT INTO lessons (subject_id, title, description, status, sequence_number, goals, tags, generated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mathId,
        "Bayes' Theorem in Practice",
        "Read, watch, explore, and code Bayes' theorem from several angles: a base-rate simulator, a frequency table, a population tree, and a scaffolded exercise.",
        "queued",
        2,
        JSON.stringify(["Derive Bayes' theorem from conditional probability", "See why rare-disease positives are usually false alarms", "Implement the posterior calculation in Python"]),
        JSON.stringify(["bayes-theorem", "classification"]),
        "doramon-lesson-generator/v2"
      )
  ).lastInsertRowid as number;
  db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)").run(lesson2Id, bayesTagId);

  insertActivity.run(
    lesson2Id,
    "audio",
    1,
    1,
    "Audio: Updating Beliefs with Evidence",
    JSON.stringify({
      script: "Bayes' theorem is a rule for updating what you believe when new evidence arrives. Start with a prior, weigh it against how likely the evidence is under each hypothesis, and you get a posterior. The surprising part is how much the base rate dominates when an event is rare.",
      duration_hint: 660,
    })
  );

  insertActivity.run(
    lesson2Id,
    "reading",
    1,
    2,
    "Read: Bayes' Theorem and the Base-Rate Trap",
    JSON.stringify({
      intro: "A 95%-accurate test sounds nearly certain. For a rare disease, a positive result can still be more likely wrong than right. Here is why.",
      blocks: [
        { type: "heading", text: "The formula" },
        { type: "definition", term: "Bayes' theorem", definition: "P(disease | +) = P(+ | disease) · P(disease) / P(+), where P(+) sums the true positives and false positives across the whole population." },
        { type: "paragraph", text: "The denominator is the key. Most positive tests come from the large healthy population, even when each healthy person is unlikely to test positive, simply because there are so many of them." },
        { type: "example", title: "10,000 people, 1% prevalence", body: "100 have the disease; 9,900 do not. With 95% sensitivity, ~95 sick people test positive. With 90% specificity, 10% of 9,900 = 990 healthy people also test positive. So P(disease | +) = 95 / (95 + 990) ≈ 8.8%." },
        { type: "callout", tone: "insight", text: "Raising the prior (a higher-risk group) is the most powerful way to make a positive test meaningful. Bring the base rate up and the posterior climbs fast." },
        { type: "list", items: ["Prior: how common the condition is before testing.", "Sensitivity: P(+ | disease), the true-positive rate.", "Specificity: P(- | healthy); 1 − specificity is the false-positive rate."] },
      ],
      summary: "Combine the prior with the test's error rates. When the prior is small, false positives from the healthy majority swamp the true positives, so a single positive test is weak evidence.",
    })
  );

  insertActivity.run(
    lesson2Id,
    "media",
    0,
    3,
    "Watch: The Medical Test Paradox",
    JSON.stringify({
      embeds: [
        {
          provider: "youtube",
          video_id: "HZGCoVF3YvM",
          title: "Bayes theorem, the geometry of changing beliefs (3Blue1Brown)",
          reason: "A visual derivation of Bayes' rule that matches the frequency-table and tree views below.",
          fallback_text: "If the video is unavailable, the frequency table and population tree in the next section show the same counts the video animates.",
        },
        {
          provider: "youtube",
          video_id: "lG4VkPoG3ko",
          title: "The medical test paradox (3Blue1Brown)",
          reason: "Explains exactly why a positive result for a rare disease is usually a false alarm.",
          fallback_text: "If the video is unavailable, re-read the '10,000 people, 1% prevalence' worked example above.",
        },
      ],
    })
  );

  // Visualization #1 — base-rate simulator with bar + frequency table + tree.
  insertActivity.run(
    lesson2Id,
    "interactive",
    1,
    4,
    "Explore: Base-Rate Simulator (3 views)",
    JSON.stringify(BAYES_MULTIVIEW_WIDGET)
  );

  // Visualization #2 — how the posterior rises with prevalence (a second perspective).
  insertActivity.run(
    lesson2Id,
    "interactive",
    1,
    5,
    "Explore: Posterior vs. Prevalence Curve",
    JSON.stringify(POSTERIOR_CURVE_WIDGET)
  );

  insertActivity.run(
    lesson2Id,
    "practice_code",
    1,
    6,
    "Python: Implement the Posterior",
    JSON.stringify({
      language: "python",
      prompt: "Write a function bayes_posterior(prior, sensitivity, specificity) that returns P(disease | positive test). Then call it with prior=0.01, sensitivity=0.95, specificity=0.90 and store the result in a variable named result.",
      constraints: [
        "Implement the math yourself with basic arithmetic.",
        "Do not hardcode 0.0876 or any final number — compute it.",
      ],
      guided_steps: [
        "true_positive = prior * sensitivity",
        "false_positive = (1 - prior) * (1 - specificity)",
        "Return true_positive / (true_positive + false_positive).",
      ],
      hints: [
        { level: 1, text: "A positive test can come from a sick person (true positive) or a healthy one (false positive). The posterior is the share that are truly sick." },
        { level: 2, text: "Build the numerator (true positives) and denominator (all positives) separately, then divide." },
        { level: 3, text: "tp = prior*sensitivity; fp = (1-prior)*(1-specificity); return tp/(tp+fp)" },
      ],
      starter_code: `def bayes_posterior(prior, sensitivity, specificity):
    # Return P(disease | positive test)
    pass

# Compute the posterior for a 1% prior, 95% sensitivity, 90% specificity.
result = None
`,
      tests: [
        { id: "t1", description: "bayes_posterior(0.01, 0.95, 0.90) ≈ 0.0876", assert: "abs(bayes_posterior(0.01, 0.95, 0.90) - 0.08756) < 0.001" },
        { id: "t2", description: "A perfectly specific test gives posterior 1.0 for any positive", assert: "abs(bayes_posterior(0.5, 0.9, 1.0) - 1.0) < 1e-9" },
        { id: "t3", description: "result is assigned and matches the 1% case", assert: "result is not None and abs(result - 0.08756) < 0.001" },
      ],
      hidden_tests: [
        { id: "h1", description: "Higher prevalence raises the posterior", assert: "bayes_posterior(0.2, 0.95, 0.9) > bayes_posterior(0.02, 0.95, 0.9)" },
        { id: "h2", description: "Posterior stays a probability in [0, 1]", assert: "0 <= bayes_posterior(0.1, 0.8, 0.7) <= 1" },
        { id: "h3", description: "Matches the textbook 10% / 80% / 90% case (~0.4706)", assert: "abs(bayes_posterior(0.1, 0.8, 0.9) - 0.4706) < 0.002" },
      ],
    })
  );

  insertActivity.run(
    lesson2Id,
    "assessment",
    1,
    7,
    "Assessment: Reasoning About Evidence",
    JSON.stringify({
      questions: [
        { id: "q1", text: "Why can a positive result on an accurate test still mean you probably do not have a rare disease?", type: "free_text" },
        { id: "q2", text: "Which single change raises the posterior the most: better sensitivity, better specificity, or a higher prior? Explain.", type: "free_text" },
        { id: "q3", text: "For prior=0.01, sensitivity=0.95, specificity=0.90, what is P(disease | positive)? Give a percentage.", type: "numeric" },
      ],
      quiz: BAYES_MC_QUIZ,
    })
  );

  // ─── Economics lesson — supply/demand + a second visualization ────────────
  const econLesson1Id = (
    db
      .prepare(
        `INSERT INTO lessons (subject_id, title, description, status, sequence_number, goals, tags, generated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        econId,
        "Supply, Demand, and Equilibrium",
        "Read the mechanics, watch a primer, explore the market simulator and tax-incidence view, then solve for equilibrium in Python.",
        "queued",
        1,
        JSON.stringify(["Understand supply/demand mechanics", "Model equilibrium computationally", "See how a tax splits between buyers and sellers"]),
        JSON.stringify(["supply-demand", "market-equilibrium"]),
        "doramon-lesson-generator/v2"
      )
  ).lastInsertRowid as number;
  db.prepare("INSERT OR IGNORE INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?)").run(econLesson1Id, supplyTagId);

  insertActivity.run(
    econLesson1Id,
    "audio",
    1,
    1,
    "Audio: How Markets Find a Price",
    JSON.stringify({
      script: "A market price is not set by anyone in particular. It emerges where the quantity buyers want equals the quantity sellers offer. Push either curve and the equilibrium slides to a new point.",
      duration_hint: 540,
    })
  );

  insertActivity.run(
    econLesson1Id,
    "reading",
    1,
    2,
    "Read: Equilibrium and Tax Incidence",
    JSON.stringify({
      intro: "Supply and demand are two relationships between price and quantity. Equilibrium is the one price where they agree.",
      blocks: [
        { type: "definition", term: "Equilibrium price", definition: "The price at which quantity demanded equals quantity supplied, so there is no pressure to change." },
        { type: "paragraph", text: "Below equilibrium, buyers want more than sellers offer and the price is bid up. Above it, unsold goods pile up and the price falls. The market gravitates to the crossing point." },
        { type: "heading", text: "Who pays a tax?" },
        { type: "paragraph", text: "A per-unit tax drives a wedge between what buyers pay and what sellers receive. The side that is less price-sensitive (more inelastic) ends up bearing more of it." },
        { type: "callout", tone: "insight", text: "Tax incidence depends on elasticity, not on who legally writes the cheque." },
      ],
      summary: "Equilibrium is the price where supply meets demand. A tax splits between buyers and sellers according to their relative elasticities.",
    })
  );

  insertActivity.run(
    econLesson1Id,
    "media",
    0,
    3,
    "Watch: Supply and Demand",
    JSON.stringify({
      embeds: [
        {
          provider: "youtube",
          video_id: "g9aUMFle5UU",
          title: "Supply and Demand: Crash Course Economics",
          reason: "A concise primer on how the two curves interact and what shifts them.",
          fallback_text: "If the video is unavailable, the simulator below lets you shift the curves directly and watch equilibrium move.",
        },
      ],
    })
  );

  insertActivity.run(
    econLesson1Id,
    "interactive",
    1,
    4,
    "Explore: Market Equilibrium Simulator",
    JSON.stringify({
      schema_version: "1.0",
      widget_type: "supply-demand",
      title: "Market Equilibrium Simulator",
      instructions: "Shift the supply and demand curves or add a per-unit tax, and watch the equilibrium price and quantity move. The black dot marks where supply meets demand.",
      params: { demandIntercept: 100, demandSlope: 1.5, supplyIntercept: 0, supplySlope: 2, priceMax: 60 },
    })
  );

  insertActivity.run(
    econLesson1Id,
    "interactive",
    1,
    5,
    "Explore: Tax Incidence Split",
    JSON.stringify(TAX_INCIDENCE_WIDGET)
  );

  insertActivity.run(
    econLesson1Id,
    "practice_code",
    1,
    6,
    "Python: Solve for Market Equilibrium",
    JSON.stringify({
      language: "python",
      prompt: "Demand is Qd = 100 - 1.5*P and supply is Qs = 2*P. Find the equilibrium price and quantity, assigning them to p_star and q_star.",
      constraints: ["Solve algebraically in code; do not hardcode 28.57.", "p_star and q_star should be floats."],
      guided_steps: [
        "Set Qd = Qs: 100 - 1.5*P = 2*P.",
        "Solve for P, then substitute back to get the quantity.",
      ],
      hints: [
        { level: 1, text: "At equilibrium the quantity demanded equals the quantity supplied." },
        { level: 2, text: "Combine like terms: 100 = 3.5*P." },
        { level: 3, text: "p_star = 100 / 3.5; q_star = 2 * p_star" },
      ],
      starter_code: `# Demand:  Qd = 100 - 1.5 * P
# Supply:  Qs = 2 * P
# Solve for the equilibrium price and quantity.

p_star = None
q_star = None
`,
      tests: [
        { id: "t1", description: "Equilibrium price ~ 28.57", assert: "abs(p_star - (100 / 3.5)) < 0.01" },
        { id: "t2", description: "Equilibrium quantity ~ 57.14", assert: "abs(q_star - (2 * (100 / 3.5))) < 0.01" },
      ],
      hidden_tests: [
        { id: "h1", description: "Quantity demanded equals quantity supplied at the solution", assert: "abs((100 - 1.5 * p_star) - (2 * p_star)) < 0.01" },
      ],
    })
  );

  insertActivity.run(
    econLesson1Id,
    "assessment",
    1,
    7,
    "Assessment: Supply, Demand, and Taxes",
    JSON.stringify({
      questions: [
        { id: "q1", text: "In your own words, what does the equilibrium price represent?", type: "free_text" },
        { id: "q2", text: "If a per-unit tax is added, what happens to the price buyers pay and the quantity traded? Why?", type: "free_text" },
        { id: "q3", text: "Who bears more of a tax when demand is very inelastic (steep): buyers or sellers?", type: "free_text" },
      ],
      quiz: SUPPLY_DEMAND_MC_QUIZ,
    })
  );

  // Some progress for the econ subject so its mastery card is not empty.
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getTime() - (3 - i) * 7 * 24 * 60 * 60 * 1000);
    db.prepare(
      "INSERT INTO progress_points (learner_id, subject_id, lesson_id, metric, value, recorded_at) VALUES (?, ?, ?, 'mastery', ?, ?)"
    ).run(learnerId, econId, econLesson1Id, 15 + i * 9, d.toISOString());
  }
  db.prepare(
    "INSERT INTO mastery_signals (learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence) VALUES (?, ?, ?, 'strength', ?, ?, ?)"
  ).run(learnerId, econId, econLesson1Id, "supply-demand", "Comfortable reading the equilibrium point.", 0.5);

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

  console.log(
    `Seed applied: synthetic user alex_learner, 2 active subjects + 1 archived (id ${archivedId}), flagship Bayes lesson ${lesson2Id}.`
  );
}

// ─── Reusable widget specs ───────────────────────────────────────────────────

/** Lesson 1 base-rate widget (bar chart only). */
const BAYES_BASE_RATE_WIDGET = {
  schema_version: "1.0",
  widget_type: "declarative",
  title: "Bayes' Theorem: The Base-Rate Trap",
  instructions:
    "A positive medical test feels alarming, but the chance you actually have the disease depends on how rare it is. Adjust prevalence, sensitivity, and specificity, then watch P(disease | positive) change.",
  controls: [
    { type: "slider", id: "prior", label: "Disease prevalence (prior)", min: 0.001, max: 0.2, step: 0.001, default: 0.01, format: "percent" },
    { type: "slider", id: "sensitivity", label: "Test sensitivity  P(+ | disease)", min: 0.5, max: 1, step: 0.01, default: 0.95, format: "percent" },
    { type: "slider", id: "specificity", label: "Test specificity  P(- | healthy)", min: 0.5, max: 1, step: 0.01, default: 0.9, format: "percent" },
  ],
  outputs: [
    { id: "prior_p", label: "Prior P(disease)", formula: "prior", format: "percent", precision: 2 },
    { id: "posterior", label: "P(disease | positive)", formula: "(prior*sensitivity)/((prior*sensitivity)+((1-prior)*(1-specificity)))", format: "percent", precision: 1 },
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
};

/**
 * Lesson 2 flagship widget: ONE set of sliders drives THREE visual perspectives
 * on the same concept — a bar chart, a frequency table, and a population tree.
 */
const BAYES_MULTIVIEW_WIDGET = {
  schema_version: "1.0",
  widget_type: "declarative",
  title: "Base-Rate Simulator — three views of the same numbers",
  instructions:
    "Out of 10,000 people, adjust how common the disease is and how accurate the test is. The bar chart, the frequency table, and the population tree all update together from the same sliders.",
  controls: [
    { type: "slider", id: "prior", label: "Disease prevalence (prior)", min: 0.001, max: 0.3, step: 0.001, default: 0.01, format: "percent" },
    { type: "slider", id: "sensitivity", label: "Sensitivity  P(+ | disease)", min: 0.5, max: 1, step: 0.01, default: 0.95, format: "percent" },
    { type: "slider", id: "specificity", label: "Specificity  P(- | healthy)", min: 0.5, max: 1, step: 0.01, default: 0.9, format: "percent" },
  ],
  outputs: [
    { id: "prior_p", label: "Prior P(disease)", formula: "prior", format: "percent", precision: 2 },
    { id: "diseased", label: "Have disease", formula: "prior * 10000", format: "integer" },
    { id: "healthy", label: "Healthy", formula: "(1 - prior) * 10000", format: "integer" },
    { id: "true_pos", label: "Sick & test +", formula: "prior * 10000 * sensitivity", format: "integer" },
    { id: "false_neg", label: "Sick & test -", formula: "prior * 10000 * (1 - sensitivity)", format: "integer" },
    { id: "false_pos", label: "Healthy & test +", formula: "(1 - prior) * 10000 * (1 - specificity)", format: "integer" },
    { id: "true_neg", label: "Healthy & test -", formula: "(1 - prior) * 10000 * specificity", format: "integer" },
    { id: "test_pos", label: "All positives", formula: "true_pos + false_pos", format: "integer" },
    { id: "posterior", label: "P(disease | +)", formula: "true_pos / (true_pos + false_pos)", format: "percent", precision: 1 },
  ],
  charts: [
    {
      type: "bar",
      title: "View 1 — Prior vs. posterior probability",
      bars: [
        { label: "Prior", ref: "prior_p", color: "#94a3b8" },
        { label: "After +test", ref: "posterior", color: "#2563eb" },
      ],
    },
    {
      type: "table",
      title: "View 2 — Frequency table (per 10,000 people)",
      headers: ["Group", "Test +", "Test −", "Total"],
      rows: [
        { label: "Disease", cells: [{ formula: "true_pos", format: "integer" }, { formula: "false_neg", format: "integer" }, { formula: "diseased", format: "integer" }] },
        { label: "Healthy", cells: [{ formula: "false_pos", format: "integer" }, { formula: "true_neg", format: "integer" }, { formula: "healthy", format: "integer" }] },
      ],
      caption: "Of everyone who tests positive, only the 'Disease / Test +' cell are truly sick.",
    },
    {
      type: "tree",
      title: "View 3 — Population tree",
      root: {
        label: "10,000 people",
        valueFormula: "10000",
        format: "integer",
        children: [
          {
            label: "Disease",
            valueFormula: "diseased",
            format: "integer",
            color: "#dc2626",
            children: [
              { label: "Test +", valueFormula: "true_pos", format: "integer", color: "#16a34a" },
              { label: "Test −", valueFormula: "false_neg", format: "integer", color: "#94a3b8" },
            ],
          },
          {
            label: "Healthy",
            valueFormula: "healthy",
            format: "integer",
            color: "#2563eb",
            children: [
              { label: "Test +", valueFormula: "false_pos", format: "integer", color: "#d97706" },
              { label: "Test −", valueFormula: "true_neg", format: "integer", color: "#16a34a" },
            ],
          },
        ],
      },
      caption: "Follow the two 'Test +' leaves: false positives from the healthy branch usually outnumber true positives.",
    },
  ],
  panels: [
    {
      title: "Read the tree",
      template:
        "About {{test_pos}} people test positive, but only {{true_pos}} of them are actually sick — a posterior of just {{posterior}}. Raise the prevalence slider and watch the posterior climb.",
    },
  ],
};

/** Lesson 2 second perspective: posterior as a function of prevalence. */
const POSTERIOR_CURVE_WIDGET = {
  schema_version: "1.0",
  widget_type: "declarative",
  title: "How the Posterior Depends on Prevalence",
  instructions:
    "Hold the test accuracy fixed and sweep the prevalence. The curve shows P(disease | positive) for every prior — notice how steeply it rises once the disease is no longer rare.",
  controls: [
    { type: "slider", id: "sensitivity", label: "Sensitivity", min: 0.5, max: 1, step: 0.01, default: 0.95, format: "percent" },
    { type: "slider", id: "specificity", label: "Specificity", min: 0.5, max: 1, step: 0.01, default: 0.9, format: "percent" },
  ],
  outputs: [
    { id: "false_alarm", label: "False-positive rate", formula: "1 - specificity", format: "percent", precision: 1 },
  ],
  chart: {
    type: "curve",
    title: "Posterior probability vs. prevalence",
    x: { id: "prevalence", label: "Disease prevalence (prior)", min: 0.001, max: 0.5, steps: 60 },
    curves: [
      { label: "P(disease | +)", formula: "(prevalence*sensitivity)/((prevalence*sensitivity)+((1-prevalence)*(1-specificity)))", color: "#2563eb" },
    ],
    yLabel: "posterior",
  },
  panels: [
    {
      title: "What changes the shape?",
      template:
        "With a false-positive rate of {{false_alarm}}, the posterior stays low for rare diseases and rises toward 1 as prevalence grows. Lower the specificity and the whole curve sags.",
    },
  ],
};

// ─── Multiple-choice quiz banks ───────────────────────────────────────────────

/**
 * 9-question Bayes' theorem MC quiz.
 * pass_threshold=6 means the learner must get 6 distinct concepts right.
 * Questions are ordered easy→hard so wrong-answer retries appear well after
 * the learner has seen all the foundational material.
 */
const BAYES_MC_QUIZ = {
  pass_threshold: 6,
  questions: [
    {
      id: "bq1",
      concept: "bayes-prior",
      difficulty: "easy",
      question: "In Bayes' theorem, what is the 'prior' probability?",
      choices: [
        "The probability of a disease before seeing the test result",
        "The probability the test is correct",
        "The probability of a positive test result",
        "The probability of a false alarm",
      ],
      correct_index: 0,
      explanation:
        "The prior is your belief about how likely the event is before any evidence is gathered — in the medical context, how prevalent the disease is in the population.",
      misconception_target: "Learners often confuse the prior with the sensitivity of the test.",
      rephrase_instructions: "Keep the medical test context. Change the wording and distractor phrasing.",
    },
    {
      id: "bq2",
      concept: "bayes-sensitivity",
      difficulty: "easy",
      question: "A test has 90% sensitivity. What does this mean?",
      choices: [
        "90% of sick people test positive",
        "90% of healthy people test negative",
        "90% of positive tests come from sick people",
        "10% of sick people are missed and test negative",
      ],
      correct_index: 0,
      explanation:
        "Sensitivity is P(+ | disease) — the fraction of truly sick people who receive a positive result. A high sensitivity means few sick people are missed.",
      misconception_target: "Learners sometimes confuse sensitivity with specificity (true-negative rate).",
      rephrase_instructions: "Use a different number and a different context (e.g. quality-control inspection) to rephrase.",
    },
    {
      id: "bq3",
      concept: "bayes-specificity",
      difficulty: "easy",
      question: "A test has 95% specificity. What does this tell you about healthy people?",
      choices: [
        "5% of healthy people will test positive (false alarms)",
        "95% of sick people will test positive",
        "5% of all tests are false alarms",
        "95% of positive tests are from sick people",
      ],
      correct_index: 0,
      explanation:
        "Specificity is P(- | healthy). At 95% specificity, 1 - 0.95 = 5% of healthy people still test positive — these are false positives.",
      misconception_target: "Learners often read 'specificity' as the overall false-alarm rate rather than as P(-|healthy).",
      rephrase_instructions: "Use a screening test in a non-medical setting (e.g. spam filter, fraud detection).",
    },
    {
      id: "bq4",
      concept: "base-rate-fallacy",
      difficulty: "medium",
      question:
        "A disease affects 1 in 1,000 people. A test is 99% sensitive and 99% specific. If you test positive, roughly what is the chance you are sick?",
      choices: [
        "About 9% — most positives are false alarms from the large healthy group",
        "About 99% — the test is nearly perfect",
        "About 50% — you are as likely sick as not",
        "About 1% — the disease is too rare to matter",
      ],
      correct_index: 0,
      explanation:
        "Prior = 0.001. True positives ≈ 0.001 × 0.99 ≈ 0.00099. False positives ≈ 0.999 × 0.01 ≈ 0.00999. Posterior ≈ 0.00099 / (0.00099 + 0.00999) ≈ 9%. The large healthy majority produces more false positives than the small sick group produces true positives.",
      misconception_target: "The classic base-rate fallacy: ignoring the prior and focusing only on test accuracy.",
      rephrase_instructions: "Change the prevalence and test accuracy numbers, but keep the punchline: the posterior is much lower than learners expect.",
    },
    {
      id: "bq5",
      concept: "posterior-update",
      difficulty: "medium",
      question: "Which factor most dramatically raises P(disease | positive) when it increases?",
      choices: [
        "The prior (disease prevalence)",
        "Test sensitivity",
        "The sample size",
        "The number of tests performed",
      ],
      correct_index: 0,
      explanation:
        "The prior is the multiplier of every other factor in Bayes' theorem. Moving from 0.1% prevalence to 1% prevalence (10×) produces a roughly 10× jump in the posterior. Sensitivity improvements in the same range are much less dramatic.",
      misconception_target: "Many learners think improving test sensitivity is the most powerful lever.",
      rephrase_instructions: "Frame the question around a practical decision: which action would make a screening program more useful?",
    },
    {
      id: "bq6",
      concept: "false-positive-source",
      difficulty: "medium",
      question:
        "For a rare condition, why do false positives outnumber true positives even when the false-positive rate is low?",
      choices: [
        "The healthy group is much larger, so even a small false-positive rate produces many false alarms",
        "The test is not accurate enough for rare conditions",
        "Rare conditions always have low sensitivity",
        "The prior is too high when the condition is rare",
      ],
      correct_index: 0,
      explanation:
        "If 99% of the population is healthy and the false-positive rate is 1%, that 1% of 99% generates far more false alarms than the true-positive rate of 1% of sick people generates true alarms.",
      misconception_target: "Learners think false positives come from test inaccuracy alone, not from the population imbalance.",
      rephrase_instructions: "Use a counting example (e.g. 10,000 people) to make the arithmetic concrete in the question stem.",
    },
    {
      id: "bq7",
      concept: "conditional-probability-direction",
      difficulty: "medium",
      question: "P(disease | positive) and P(positive | disease) are:",
      choices: [
        "Different quantities — one is the posterior, the other is the sensitivity",
        "The same quantity — both express test accuracy",
        "Complementary — they add up to 1",
        "Equal when the disease prevalence is 50%",
      ],
      correct_index: 0,
      explanation:
        "P(positive | disease) is sensitivity (given you are sick, how often does the test flag you?). P(disease | positive) is the posterior (given a positive result, how likely are you sick?). These are reversed conditions and generally have very different values.",
      misconception_target: "Confusion between the two conditional directions is the core of the prosecutors' fallacy.",
      rephrase_instructions: "Reframe using a legal or forensic scenario to give it a different context.",
    },
    {
      id: "bq8",
      concept: "bayes-formula-structure",
      difficulty: "hard",
      question:
        "In the formula P(H|E) = P(E|H)·P(H) / P(E), what does the denominator P(E) represent?",
      choices: [
        "The total probability of seeing the evidence under all hypotheses (true positives plus false positives)",
        "The prior probability of the hypothesis",
        "The probability that the evidence is accurate",
        "One minus the false-positive rate",
      ],
      correct_index: 0,
      explanation:
        "P(E) = P(E|H)·P(H) + P(E|¬H)·P(¬H). It sums all the ways the evidence can occur — both when the hypothesis is true (true positives) and when it is false (false positives). It normalises the posterior so it is a valid probability.",
      misconception_target: "Learners often skip the denominator and only think about the numerator, leading to un-normalised posteriors.",
      rephrase_instructions: "Phrase it as: 'what does the bottom of the Bayes fraction count?'",
    },
    {
      id: "bq9",
      concept: "sequential-testing",
      difficulty: "hard",
      question:
        "A second independent test is run on someone who tested positive the first time. What should you use as the prior for the second test?",
      choices: [
        "The posterior from the first test — it is now your updated belief",
        "The original population prevalence — ignore the first result",
        "The sensitivity of the second test",
        "The average of the prior and the first posterior",
      ],
      correct_index: 0,
      explanation:
        "Bayesian updating is sequential: after seeing evidence, the posterior becomes the new prior. Running a second test with the first posterior as input greatly improves the overall positive predictive value, which is why repeat testing is used in screening programs.",
      misconception_target: "Learners reset to the original prior rather than updating it with each new piece of evidence.",
      rephrase_instructions: "Use a different context — drug testing with a confirmatory test, or two witnesses in a court case.",
    },
  ],
};

/**
 * 9-question supply-and-demand MC quiz.
 * pass_threshold=6.
 */
const SUPPLY_DEMAND_MC_QUIZ = {
  pass_threshold: 6,
  questions: [
    {
      id: "eq1",
      concept: "equilibrium-definition",
      difficulty: "easy",
      question: "What is the equilibrium price in a market?",
      choices: [
        "The price at which quantity demanded equals quantity supplied",
        "The price set by the government to stabilise the market",
        "The highest price sellers are willing to accept",
        "The average of the minimum and maximum prices in the market",
      ],
      correct_index: 0,
      explanation:
        "Equilibrium is where the supply and demand curves cross. At this price there is no surplus or shortage — every buyer who wants to buy at that price finds a seller, and vice versa.",
      misconception_target: "Students often confuse equilibrium with a price ceiling/floor set by an external authority.",
      rephrase_instructions: "Use a different market context (e.g. used cars, concert tickets) and rephrase the distractors.",
    },
    {
      id: "eq2",
      concept: "demand-curve-slope",
      difficulty: "easy",
      question: "Why does the demand curve slope downward?",
      choices: [
        "As price falls, more consumers are willing and able to buy",
        "As price falls, suppliers produce less",
        "Higher prices attract more buyers",
        "The demand curve shows cost, not willingness to pay",
      ],
      correct_index: 0,
      explanation:
        "The law of demand: all else equal, a lower price makes the good accessible to more buyers and encourages existing buyers to buy more. This negative price–quantity relationship gives the demand curve its downward slope.",
      misconception_target: "Learners sometimes mix up movements along the demand curve with shifts of the curve.",
      rephrase_instructions: "Frame it as: 'what causes quantity demanded to rise when price falls?' and use a fresh product example.",
    },
    {
      id: "eq3",
      concept: "supply-curve-slope",
      difficulty: "easy",
      question: "Why does the supply curve slope upward?",
      choices: [
        "Higher prices make production more profitable, so sellers offer more units",
        "Higher prices discourage buyers, so sellers need to produce less",
        "Sellers want to keep prices stable, so they supply the same amount at any price",
        "The supply curve shows consumer demand, not producer behaviour",
      ],
      correct_index: 0,
      explanation:
        "The law of supply: a higher market price covers costs for more sellers and makes additional production worthwhile, so quantity supplied rises with price.",
      misconception_target: "Confusion between demand-side and supply-side logic; learners sometimes think high prices reduce supply.",
      rephrase_instructions: "Use a different product (e.g. organic tomatoes, handmade furniture) and vary the distractor reasoning.",
    },
    {
      id: "eq4",
      concept: "surplus-shortage",
      difficulty: "medium",
      question:
        "At a price above equilibrium, what happens in the market?",
      choices: [
        "A surplus arises: sellers offer more than buyers want, pushing the price back down",
        "A shortage arises: buyers want more than sellers offer, pushing the price up",
        "The market clears at that price because demand adjusts to match supply",
        "Nothing changes — prices are sticky and stay above equilibrium",
      ],
      correct_index: 0,
      explanation:
        "Above equilibrium, quantity supplied exceeds quantity demanded. Unsold inventory accumulates, incentivising sellers to lower prices until the surplus disappears at the equilibrium price.",
      misconception_target: "Students mix up surplus (price too high) and shortage (price too low).",
      rephrase_instructions: "Use a concrete example like too many apartments listed at a high rent, and ask what landlords are forced to do.",
    },
    {
      id: "eq5",
      concept: "tax-incidence",
      difficulty: "medium",
      question:
        "A per-unit tax is placed on sellers of a good. Who ultimately bears the tax burden?",
      choices: [
        "Both buyers and sellers, in proportions determined by their relative elasticities",
        "Only sellers, because they write the cheque to the government",
        "Only buyers, because prices always rise by the full tax amount",
        "Neither — the tax is absorbed by the government with no effect on market participants",
      ],
      correct_index: 0,
      explanation:
        "The legal incidence (who pays the government) is irrelevant to the economic incidence (who bears the cost). The burden splits according to elasticity: the less elastic (more inelastic) side bears more of the tax.",
      misconception_target: "The most common error is assuming the legal payer (seller or buyer) bears the whole tax.",
      rephrase_instructions: "Flip it: put the tax on buyers and ask who bears it — same answer, different framing.",
    },
    {
      id: "eq6",
      concept: "elasticity-incidence",
      difficulty: "medium",
      question:
        "Demand for insulin is highly inelastic (buyers must have it regardless of price). If a tax is placed on insulin sales, who bears most of the tax?",
      choices: [
        "Buyers — because they cannot easily reduce their consumption when the price rises",
        "Sellers — because they are the ones legally paying the tax",
        "The government — it collects the tax revenue",
        "Neither side, because inelastic demand prevents prices from rising",
      ],
      correct_index: 0,
      explanation:
        "Inelastic demand means buyers do not reduce quantity much when price rises. Sellers can therefore pass most of the tax to buyers through higher prices without losing many sales. The more inelastic the demand relative to supply, the larger the buyers' share of the tax burden.",
      misconception_target: "Students often default to 'the seller pays the tax' rather than reasoning about elasticity.",
      rephrase_instructions: "Use a different inelastic good (e.g. petrol, essential medication) and ask which party bears more of a carbon tax or excise duty.",
    },
    {
      id: "eq7",
      concept: "demand-shift",
      difficulty: "medium",
      question:
        "Consumer incomes rise substantially. For a normal good, what happens to the demand curve and the equilibrium?",
      choices: [
        "Demand shifts right; both equilibrium price and quantity rise",
        "Demand shifts left; equilibrium price falls and quantity rises",
        "Supply shifts right; equilibrium price falls and quantity rises",
        "The equilibrium does not change because supply is fixed",
      ],
      correct_index: 0,
      explanation:
        "A rise in income shifts the demand curve for normal goods to the right — more is demanded at every price. With supply unchanged, the demand shift raises both the equilibrium price and the equilibrium quantity.",
      misconception_target: "Learners confuse a movement along the demand curve (price change) with a shift of the curve (income change).",
      rephrase_instructions: "Ask about a different demand shifter, such as a change in the price of a complement or a substitute.",
    },
    {
      id: "eq8",
      concept: "price-ceiling",
      difficulty: "hard",
      question:
        "A government sets a price ceiling below the equilibrium price. What is the most likely result?",
      choices: [
        "A shortage: quantity demanded exceeds quantity supplied at the capped price",
        "A surplus: quantity supplied exceeds quantity demanded at the capped price",
        "No effect: markets always reach equilibrium regardless of ceilings",
        "The equilibrium price shifts upward to compensate for the ceiling",
      ],
      correct_index: 0,
      explanation:
        "A price ceiling below equilibrium prevents the price from rising to clear the market. At the artificially low price, buyers want more than sellers are willing to supply — creating a shortage. Rent control is a classic example.",
      misconception_target: "Confusing ceilings (create shortages) with floors (create surpluses).",
      rephrase_instructions: "Use a price floor below equilibrium instead and ask if a shortage or surplus results — a deliberately different scenario to test careful reading.",
    },
    {
      id: "eq9",
      concept: "deadweight-loss",
      difficulty: "hard",
      question:
        "When a tax reduces the quantity traded in a market below the equilibrium level, the foregone surplus is called:",
      choices: [
        "Deadweight loss — trades that would have benefited both parties but no longer occur",
        "Tax revenue — the amount collected by the government",
        "Consumer surplus — the benefit to buyers from paying less than their maximum willingness to pay",
        "Price elasticity — the responsiveness of quantity to a price change",
      ],
      correct_index: 0,
      explanation:
        "A tax drives a wedge between the buyer's price and the seller's price, reducing the quantity traded. The transactions that would have happened without the tax but no longer do represent foregone value to both buyers and sellers — this is the deadweight loss, or efficiency cost, of the tax.",
      misconception_target: "Students often confuse deadweight loss with the tax revenue transferred to the government.",
      rephrase_instructions: "Frame it around a quantity restriction (quota) rather than a tax to test the same concept with a different policy tool.",
    },
  ],
};

/** Economics second perspective: how a per-unit tax splits between buyer and seller. */
const TAX_INCIDENCE_WIDGET = {
  schema_version: "1.0",
  widget_type: "declarative",
  title: "Tax Incidence: Who Really Pays?",
  instructions:
    "A per-unit tax raises the price buyers pay and lowers what sellers keep. Adjust how price-sensitive each side is and the tax size, then see how the burden splits.",
  controls: [
    { type: "slider", id: "demand_elasticity", label: "Demand sensitivity (slope)", min: 0.5, max: 4, step: 0.1, default: 1.5 },
    { type: "slider", id: "supply_elasticity", label: "Supply sensitivity (slope)", min: 0.5, max: 4, step: 0.1, default: 2 },
    { type: "slider", id: "tax", label: "Per-unit tax", min: 0, max: 20, step: 0.5, default: 8, format: "currency" },
  ],
  outputs: [
    { id: "buyer_share", label: "Buyers' share", formula: "supply_elasticity / (supply_elasticity + demand_elasticity)", format: "percent", precision: 0 },
    { id: "seller_share", label: "Sellers' share", formula: "demand_elasticity / (supply_elasticity + demand_elasticity)", format: "percent", precision: 0 },
    { id: "buyer_pays", label: "Tax paid by buyers", formula: "tax * supply_elasticity / (supply_elasticity + demand_elasticity)", format: "currency", precision: 2 },
    { id: "seller_pays", label: "Tax paid by sellers", formula: "tax * demand_elasticity / (supply_elasticity + demand_elasticity)", format: "currency", precision: 2 },
  ],
  chart: {
    type: "bar",
    title: "Tax burden split ($ per unit)",
    bars: [
      { label: "Buyers", ref: "buyer_pays", color: "#2563eb" },
      { label: "Sellers", ref: "seller_pays", color: "#d97706" },
    ],
  },
  panels: [
    {
      title: "Elasticity decides",
      template:
        "Buyers bear {{buyer_share}} of the tax and sellers {{seller_share}}. The more inelastic side (the steeper, less responsive curve) carries more of the burden, no matter who sends the payment.",
    },
  ],
};
