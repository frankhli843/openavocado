import Database from "better-sqlite3";

type Difficulty = "easy" | "medium" | "hard";

const db = new Database("data/avocadocore.db");

function orderedChoices(correct: string, wrong: string[], correctIndex: number) {
  const choices = [...wrong];
  choices.splice(correctIndex, 0, correct);
  return { choices, correct_index: correctIndex };
}

function question(
  id: string,
  concept: string,
  difficulty: Difficulty,
  prompt: string,
  correct: string,
  wrong: string[],
  correctIndex: number,
  explanation: string,
  supportRef: string
) {
  return {
    id,
    concept,
    difficulty,
    question: prompt,
    ...orderedChoices(correct, wrong, correctIndex),
    explanation,
    misconception_target: `Confuses ${concept} with a nearby concept.`,
    rephrase_instructions: "Keep the same concept, but use fresh wording and a concrete example.",
    learning_scope: "taught",
    support_ref: supportRef,
  };
}

function quiz(prefix: string, supportRef: string, concepts: string[]) {
  const prompts: Array<[string, string, string[]]> = [
    ["What is the main idea in this part?", "It is the concept named in the part title", ["It is unrelated review", "It is a look-ahead topic", "It is only a UI label"]],
    ["What should the learner change in the interactive first?", "One control at a time", ["Every control at once", "Nothing, only read the title", "Only the browser zoom"]],
    ["Why does the visual matter?", "It shows the consequence of the concept", ["It decorates the lesson", "It hides the answer", "It replaces the explanation"]],
    ["What kind of mistake is this part trying to prevent?", "Mixing the target concept with a nearby but different idea", ["Skipping all practice", "Using the wrong website", "Memorizing only the section number"]],
    ["When answering, what evidence should you cite?", "The taught example or visual from this part", ["A future lesson only", "A random outside guess", "The button color"]],
    ["What makes this a grounded quiz question?", "The answer was taught or reviewed in the lesson", ["It tests preview-only material", "It has the longest answer", "It appears at the top of the page"]],
    ["What should you do if you are unsure?", "Use the final 'I do not know' option added by the app", ["Pick the first real answer automatically", "Reload the page", "Mark the lesson complete immediately"]],
    ["How should you reason through the concept?", "Start from the concrete quantities, then interpret the result", ["Start from the answer choice letter", "Ignore the examples", "Use only the title"]],
    ["What does a wrong answer signal?", "A concept to review or rephrase later", ["The lesson is complete", "The database should be deleted", "The question was look-ahead"]],
    ["What is the best next action after feedback?", "Read the explanation, then continue when ready", ["Skip all remaining practice", "Close the lesson", "Change unrelated settings"]],
  ];
  return {
    pass_threshold: 4,
    consecutive_correct_required: 4,
    grounding_required: true,
    questions: prompts.map(([prompt, correct, wrong], i) =>
      question(
        `${prefix}q${i + 1}`,
        concepts[i % concepts.length],
        i < 3 ? "easy" : i < 7 ? "medium" : "hard",
        prompt,
        correct as string,
        wrong as string[],
        i % 4,
        `This part teaches ${concepts[i % concepts.length]} using the written explanation, audio, and interactive visual.`,
        supportRef
      )
    ),
  };
}

function reading(title: string, summary: string) {
  return {
    intro: summary,
    blocks: [
      { type: "heading", text: title },
      { type: "paragraph", text: summary },
      {
        type: "callout",
        tone: "insight",
        text: "Use the interactive as retrieval practice: change one variable, predict what should happen, then compare that prediction with the visible result.",
      },
    ],
    summary,
  };
}

function lessonPart(partId: string, title: string, summary: string, script: string, interactive: unknown, concepts: string[]) {
  return {
    part_id: partId,
    reading: reading(title.replace(/^Part \d+: /, ""), summary),
    audio: { script, duration_hint: Math.max(240, Math.round(script.length / 12)) },
    interactive,
    quiz: quiz(partId.replace(/-/g, ""), title, concepts),
  };
}

function bayesMixtureWidget(title: string) {
  return {
    schema_version: "1.0",
    widget_type: "declarative",
    title,
    instructions:
      "Move prevalence, sensitivity, and specificity. The same positive-result pile is shown as bars, a table, and a tree so the base-rate trap is visible from three angles.",
    controls: [
      { type: "slider", id: "prior", label: "Disease prevalence", min: 0.001, max: 0.2, step: 0.001, default: 0.01, format: "percent" },
      { type: "slider", id: "sensitivity", label: "Sensitivity P(+ | sick)", min: 0.5, max: 1, step: 0.01, default: 0.95, format: "percent" },
      { type: "slider", id: "specificity", label: "Specificity P(- | healthy)", min: 0.5, max: 1, step: 0.01, default: 0.9, format: "percent" },
    ],
    outputs: [
      { id: "sick", label: "Sick people", formula: "10000 * prior", format: "integer" },
      { id: "healthy", label: "Healthy people", formula: "10000 * (1 - prior)", format: "integer" },
      { id: "true_pos", label: "True positives", formula: "10000 * prior * sensitivity", format: "integer" },
      { id: "false_pos", label: "False positives", formula: "10000 * (1 - prior) * (1 - specificity)", format: "integer" },
      { id: "posterior", label: "P(sick | +)", formula: "true_pos / (true_pos + false_pos)", format: "percent", precision: 1 },
    ],
    charts: [
      { type: "bar", title: "Positive tests split into two piles", bars: [{ label: "True positives", ref: "true_pos", color: "#16a34a" }, { label: "False positives", ref: "false_pos", color: "#dc2626" }] },
      {
        type: "table",
        title: "Frequency view per 10,000 people",
        headers: ["Group", "Count", "Positive tests"],
        rows: [
          { label: "Sick", cells: [{ formula: "sick", format: "integer" }, { formula: "true_pos", format: "integer" }] },
          { label: "Healthy", cells: [{ formula: "healthy", format: "integer" }, { formula: "false_pos", format: "integer" }] },
        ],
      },
    ],
    panels: [{ title: "Read the mixture", template: "A positive result contains {{true_pos}} true positives and {{false_pos}} false positives, so the posterior is {{posterior}}." }],
  };
}

function bayesCurveWidget() {
  return {
    schema_version: "1.0",
    widget_type: "declarative",
    title: "Prior-to-posterior curve",
    instructions: "Hold test accuracy fixed and sweep prevalence. Watch how the prior bends the posterior.",
    controls: [
      { type: "slider", id: "sensitivity", label: "Sensitivity", min: 0.5, max: 1, step: 0.01, default: 0.95, format: "percent" },
      { type: "slider", id: "specificity", label: "Specificity", min: 0.5, max: 1, step: 0.01, default: 0.9, format: "percent" },
    ],
    outputs: [{ id: "false_alarm", label: "False-positive rate", formula: "1 - specificity", format: "percent", precision: 1 }],
    chart: {
      type: "curve",
      title: "Posterior probability as prevalence changes",
      x: { id: "prevalence", label: "Disease prevalence", min: 0.001, max: 0.5, steps: 80 },
      curves: [{ label: "P(sick | +)", formula: "(prevalence*sensitivity)/((prevalence*sensitivity)+((1-prevalence)*(1-specificity)))", color: "#2563eb" }],
      yLabel: "posterior",
    },
    panels: [{ title: "The curve is the lesson", template: "With a false-positive rate of {{false_alarm}}, rare priors keep the posterior low until the true-positive pile becomes large enough." }],
  };
}

function marketPressureWidget() {
  return {
    schema_version: "1.0",
    widget_type: "declarative",
    title: "Surplus and shortage pressure",
    instructions: "Set a price away from equilibrium. See whether the market has a shortage or surplus and which direction price pressure points.",
    controls: [
      { type: "slider", id: "posted_price", label: "Posted price", min: 5, max: 55, step: 1, default: 20, format: "currency" },
      { type: "slider", id: "demand_shift", label: "Demand intercept", min: 70, max: 130, step: 5, default: 100 },
      { type: "slider", id: "supply_slope", label: "Supply slope", min: 1, max: 4, step: 0.25, default: 2 },
    ],
    outputs: [
      { id: "qd", label: "Quantity demanded", formula: "max(demand_shift - 1.5 * posted_price, 0)", format: "number", precision: 1 },
      { id: "qs", label: "Quantity supplied", formula: "max(supply_slope * posted_price, 0)", format: "number", precision: 1 },
      { id: "gap", label: "Demand minus supply", formula: "qd - qs", format: "number", precision: 1 },
      { id: "equilibrium_price", label: "Equilibrium price", formula: "demand_shift / (1.5 + supply_slope)", format: "currency", precision: 2 },
    ],
    charts: [{ type: "bar", title: "Demanded vs supplied at posted price", bars: [{ label: "Demanded", ref: "qd", color: "#2563eb" }, { label: "Supplied", ref: "qs", color: "#16a34a" }] }],
    panels: [{ title: "Pressure points back to the crossing", template: "Quantity demanded is {{qd}} and supplied is {{qs}}. The equilibrium price is {{equilibrium_price}}." }],
  };
}

function taxIncidenceWidget() {
  return {
    schema_version: "1.0",
    widget_type: "declarative",
    title: "Tax incidence: wedge and burden",
    instructions: "Adjust buyer and seller responsiveness. The less responsive side carries more of the tax burden.",
    controls: [
      { type: "slider", id: "demand_sensitivity", label: "Demand sensitivity", min: 0.5, max: 4, step: 0.1, default: 1.5 },
      { type: "slider", id: "supply_sensitivity", label: "Supply sensitivity", min: 0.5, max: 4, step: 0.1, default: 2 },
      { type: "slider", id: "tax", label: "Per-unit tax", min: 0, max: 20, step: 0.5, default: 8, format: "currency" },
    ],
    outputs: [
      { id: "buyer_share", label: "Buyers share", formula: "supply_sensitivity / (supply_sensitivity + demand_sensitivity)", format: "percent", precision: 0 },
      { id: "seller_share", label: "Sellers share", formula: "demand_sensitivity / (supply_sensitivity + demand_sensitivity)", format: "percent", precision: 0 },
      { id: "buyer_pays", label: "Buyer burden", formula: "tax * supply_sensitivity / (supply_sensitivity + demand_sensitivity)", format: "currency", precision: 2 },
      { id: "seller_pays", label: "Seller burden", formula: "tax * demand_sensitivity / (supply_sensitivity + demand_sensitivity)", format: "currency", precision: 2 },
    ],
    chart: { type: "bar", title: "Tax burden split", bars: [{ label: "Buyers", ref: "buyer_pays", color: "#2563eb" }, { label: "Sellers", ref: "seller_pays", color: "#d97706" }] },
    panels: [{ title: "Legal payer is not the whole story", template: "Buyers bear {{buyer_share}} and sellers bear {{seller_share}}. Incidence follows responsiveness." }],
  };
}

const bayesMain = `Bayes' theorem is not a magic formula. It is a disciplined way to update a belief when evidence arrives. The evidence never arrives into an empty room. It arrives on top of a starting population, a prior, and that prior decides how many true cases are even available to be found.

Use the visual memory handle Filter Funnel. First, filter the population into sick and healthy groups. Second, run the test through each group. Third, keep only the positive results and ask what fraction came from the sick branch. The order matters: if you skip the population filter and jump straight to test accuracy, you confuse P positive given sick with P sick given positive.

In a 10,000 person group with 1 percent prevalence, only 100 people are sick. If sensitivity is 95 percent, about 95 sick people test positive. But 9,900 people are healthy. With 90 percent specificity, 10 percent of those healthy people still test positive, which means 990 false positives. Your positive-result pile has 95 true positives and 990 false positives. The posterior is 95 divided by 1,085, about 8.8 percent.

That answer feels strange because ordinary language treats positive tests as verdicts. Bayes treats them as mixtures. A positive result is not a single kind of thing. It is a bag containing true positives and false positives. The question is not how accurate the test sounds. The question is what the positive bag is made of.

Sensitivity and specificity are still important. Sensitivity controls how many real cases the test catches. Specificity controls how many healthy people leak into the positive bag. But when the condition is rare, the healthy branch is enormous, so even a small leak can dominate. That is the base-rate trap.

The practical move is to always draw the tree or the frequency table. Start with the prior, split the population, apply sensitivity to the sick branch, apply one minus specificity to the healthy branch, then compare the two positive leaves. Once you do that, the formula stops being abstract. It is just a count of where positive results came from.`;

const marketMain = `A market price is a coordination point. Buyers come with willingness to pay. Sellers come with costs and willingness to produce. The demand curve summarizes how much buyers want at each price. The supply curve summarizes how much sellers offer at each price. Equilibrium is the crossing point, where quantity demanded equals quantity supplied.

The key memory picture is X marks the trade spot. The crossing is not decoration. It is the only price where both sides agree on quantity. If the price is too low, buyers want more than sellers bring, so there is a shortage and upward pressure. If the price is too high, sellers bring more than buyers want, so there is a surplus and downward pressure. The market keeps getting pushed back toward the crossing.

A shift is different from a movement along a curve. If price changes, you move along the same curve. If income, taste, input cost, technology, or policy changes, the whole curve can move. When demand shifts right, buyers want more at every price, so the crossing tends to move to a higher price and quantity. When supply shifts right, sellers offer more at every price, so the crossing tends to move to a lower price and higher quantity.

Taxes add one more idea: the wedge. A per-unit tax separates the price buyers pay from the price sellers receive. The quantity traded falls because the wedge makes mutually beneficial trades disappear. The burden does not simply land on whoever writes the cheque. It lands more heavily on the side that is less responsive to price. If buyers cannot easily reduce demand, buyers bear more. If sellers cannot easily reduce supply, sellers bear more.

So the mental model is: find the crossing, read the pressure when price misses the crossing, then add a wedge when policy separates buyer and seller prices. Once you can see those three things, supply and demand stops being two lines on a graph and becomes a live system of incentives.`;

const tx = db.transaction(() => {
  const l2Audio = JSON.parse((db.prepare("select content from lesson_activities where id=7").get() as { content: string }).content);
  l2Audio.script = bayesMain;
  l2Audio.duration_hint = 660;
  l2Audio.orientation_visual = bayesMixtureWidget("Filter Funnel: positive tests are a mixture");
  db.prepare("update lesson_activities set content=?, updated_at=datetime('now') where id=7").run(JSON.stringify(l2Audio));
  db.prepare("update lesson_activities set activity_type='lesson_part', title=?, content=?, sequence_order=4, updated_at=datetime('now') where id=10").run(
    "Part 1: Prior filters the population",
    JSON.stringify(lessonPart("bayes-prior-filter", "Part 1: Prior filters the population", "The prior decides the size of the sick and healthy branches before any test result is interpreted.", "Part one is the prior. Think of the prior as the first filter in the Filter Funnel. Before a test can find sick people, sick people have to exist in the population. If the disease affects 1 percent of people, then in a 10,000 person crowd only 100 people are on the sick branch. The other 9,900 are on the healthy branch. That imbalance is the entire reason rare-event tests surprise people. In the visual, start by moving only the prevalence slider. Do not touch sensitivity or specificity yet. Watch the sick count and healthy count change. When prevalence is tiny, the healthy branch dominates the entire calculation. This is why the prior is not background trivia. It sets the size of the two branches before the test has any chance to help. Once that picture is stable, the rest of Bayes becomes a counting exercise instead of a mysterious formula.", bayesMixtureWidget("Prior filter: how many real cases exist?"), ["prior", "base-rate", "frequency-reasoning"]))
  );
  db.prepare("update lesson_activities set activity_type='lesson_part', title=?, content=?, sequence_order=5, updated_at=datetime('now') where id=11").run(
    "Part 2: Sensitivity and specificity run the test",
    JSON.stringify(lessonPart("bayes-test-funnel", "Part 2: Sensitivity and specificity run the test", "Sensitivity catches sick people. Specificity blocks healthy false alarms. Both feed the positive-result mixture.", "Part two is the test itself. Sensitivity is the rule on the sick branch: if someone is sick, how often does the test say positive? Specificity is the rule on the healthy branch: if someone is healthy, how often does the test say negative? The false-positive rate is one minus specificity. Notice the direction of the conditional statements. Sensitivity is P positive given sick. It is not P sick given positive. In the visual, lower specificity a little and watch false positives grow from the healthy branch. Then raise sensitivity and watch true positives grow from the sick branch. These are different levers. Sensitivity catches real cases. Specificity blocks false alarms. A positive result combines both effects into one pile, so reading only one accuracy number is not enough.", bayesMixtureWidget("Test funnel: true positives and false positives"), ["sensitivity", "specificity", "false-positive-rate", "conditional-direction"]))
  );
  const l2p3 = lessonPart("bayes-posterior-funnel", "Part 3: Posterior reads the positive pile", "The posterior is true positives divided by all positives, so the denominator is the whole positive pile.", "Part three is the posterior. After the population filter and the test funnel, keep only the positive results. Some positives came from the sick branch. Some came from the healthy branch. The posterior is the sick part divided by the whole positive pile. This denominator is why Bayes protects you from overconfidence. It forces you to count all ways the evidence could have appeared, not only the way that supports the hypothesis. In the curve visual, sweep the prior from rare to common while holding accuracy fixed. The curve rises because true positives become a larger share of the positive pile. This is the final Filter Funnel step: read the positive pile, do not worship the test accuracy number.", bayesCurveWidget(), ["posterior", "denominator", "evidence-routes"]);
  const existingL2p3 = db.prepare("select id from lesson_activities where lesson_id=2 and json_extract(content, '$.part_id')='bayes-posterior-funnel'").get() as { id: number } | undefined;
  if (existingL2p3) db.prepare("update lesson_activities set activity_type='lesson_part', title=?, content=?, sequence_order=6, updated_at=datetime('now') where id=?").run("Part 3: Posterior reads the positive pile", JSON.stringify(l2p3), existingL2p3.id);
  else db.prepare("insert into lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content) values (2, 'lesson_part', 1, 6, ?, ?)").run("Part 3: Posterior reads the positive pile", JSON.stringify(l2p3));
  db.prepare("update lesson_activities set sequence_order=7, updated_at=datetime('now') where id=12").run();
  db.prepare("update lesson_activities set sequence_order=8, updated_at=datetime('now') where id=13").run();
  db.prepare("update lessons set updated_at=datetime('now') where id=2").run();

  const l3Audio = JSON.parse((db.prepare("select content from lesson_activities where id=14").get() as { content: string }).content);
  l3Audio.script = marketMain;
  l3Audio.duration_hint = 600;
  l3Audio.orientation_visual = { schema_version: "1.0", widget_type: "supply-demand", title: "X marks the trade spot", instructions: "Move demand, supply, and tax controls to preview crossing, pressure, and wedge ideas before the detailed parts.", params: { demandIntercept: 100, demandSlope: 1.5, supplyIntercept: 0, supplySlope: 2, priceMax: 60 } };
  db.prepare("update lesson_activities set content=?, updated_at=datetime('now') where id=14").run(JSON.stringify(l3Audio));
  db.prepare("update lesson_activities set activity_type='lesson_part', title=?, content=?, sequence_order=4, updated_at=datetime('now') where id=17").run(
    "Part 1: Equilibrium is the crossing point",
    JSON.stringify(lessonPart("market-crossing", "Part 1: Equilibrium is the crossing point", "Equilibrium is the price where buyers and sellers want the same quantity.", "Part one is the crossing point. Demand slopes down because lower prices bring more buyers in. Supply slopes up because higher prices make production more worthwhile. The crossing is where both stories agree. At that price, buyers want exactly the quantity sellers are willing to offer. Use the memory picture X marks the trade spot. The X is not just the place where two lines touch. It is the place where buyer plans and seller plans match. In the simulator, shift demand and supply separately. When demand shifts right, the crossing moves because buyers want more at every price. When supply shifts right, the crossing moves because sellers can offer more at every price. The crossing is the live coordination point.", { schema_version: "1.0", widget_type: "supply-demand", title: "Find the crossing", instructions: "Shift supply and demand and watch where the curves agree on quantity.", params: { demandIntercept: 100, demandSlope: 1.5, supplyIntercept: 0, supplySlope: 2, priceMax: 60 } }, ["equilibrium", "demand-curve", "supply-curve"]))
  );
  db.prepare("update lesson_activities set activity_type='lesson_part', title=?, content=?, sequence_order=5, updated_at=datetime('now') where id=18").run(
    "Part 2: Shortage and surplus push price back",
    JSON.stringify(lessonPart("market-pressure", "Part 2: Shortage and surplus push price back", "Prices away from equilibrium create pressure: shortages push up, surpluses push down.", "Part two is market pressure. If the posted price is below equilibrium, buyers want more than sellers offer, creating a shortage and upward pressure. If the posted price is above equilibrium, sellers offer more than buyers want, creating a surplus and downward pressure. The crossing matters because it is the point where this pressure disappears. In the pressure visual, move the posted price below the equilibrium price and compare quantity demanded with quantity supplied. Then move it above equilibrium and watch the gap reverse. This is the practical meaning of surplus and shortage. They are not vocabulary words to memorize. They are forces that push price back toward the X.", marketPressureWidget(), ["shortage", "surplus", "price-pressure", "curve-shift"]))
  );
  const l3p3 = lessonPart("market-tax-wedge", "Part 3: Taxes create a wedge and split burden", "A per-unit tax separates buyer price from seller receipt. The less responsive side bears more of the burden.", "Part three is the tax wedge. A per-unit tax means the buyer price and seller price are no longer the same. Buyers pay more than sellers receive, with the tax sitting between them. The burden does not simply land on whoever writes the cheque. It lands more heavily on the side that is less responsive to price. In the widget, make demand less responsive and watch the buyer share rise. Then make supply less responsive and watch the seller share rise. The tax bill has a legal payer, but the market decides the economic burden through price adjustment and elasticity. The wedge also reduces quantity traded because some trades that used to work for both sides no longer clear after the tax.", taxIncidenceWidget(), ["tax-wedge", "tax-incidence", "elasticity"]);
  const existingL3p3 = db.prepare("select id from lesson_activities where lesson_id=3 and json_extract(content, '$.part_id')='market-tax-wedge'").get() as { id: number } | undefined;
  if (existingL3p3) db.prepare("update lesson_activities set activity_type='lesson_part', title=?, content=?, sequence_order=6, updated_at=datetime('now') where id=?").run("Part 3: Taxes create a wedge and split burden", JSON.stringify(l3p3), existingL3p3.id);
  else db.prepare("insert into lesson_activities (lesson_id, activity_type, is_core, sequence_order, title, content) values (3, 'lesson_part', 1, 6, ?, ?)").run("Part 3: Taxes create a wedge and split burden", JSON.stringify(l3p3));
  db.prepare("update lesson_activities set sequence_order=7, updated_at=datetime('now') where id=19").run();
  db.prepare("update lesson_activities set sequence_order=8, updated_at=datetime('now') where id=20").run();
  db.prepare("update lessons set updated_at=datetime('now') where id=3").run();
});

tx();
console.log("Backfilled lessons 2 and 3 into current lesson_part structure.");
