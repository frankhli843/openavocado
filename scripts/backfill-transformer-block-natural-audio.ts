#!/usr/bin/env tsx
/**
 * Rewrites the transformer-block demo audio transcripts into a more natural
 * Socratic podcast dialogue and regenerates matching audio artifacts.
 *
 * Usage:
 *   AVOCADOCORE_DB_PATH=/var/prodavo/data/avocadocore.db pnpm tsx scripts/backfill-transformer-block-natural-audio.ts --lesson-id 64 --lesson-id 11 --audio
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { generateLessonAudio } from "../src/lib/audio/generate-lesson-audio";

interface ActivityRow {
  id: number;
  title: string | null;
  activity_type: string;
  content: string;
}

const OVERVIEW_TITLE = "Orientation: What Happens Inside One Transformer Block";
const QKV_TITLE = "How Q, K, V Produce Attention Scores";
const RESIDUAL_TITLE = "The Residual Stream: How Information Flows Through Blocks";
const MLP_TITLE = "The MLP: Per-Token Expansion and the GELU Gate";

function dialogue(turns: string[]): string {
  return turns.map((t) => t.trim()).join("\n\n");
}

const overviewTranscript = dialogue([
  `Leo: Let's make one transformer block feel like a place you can walk through. Put three tokens on the table: "the", "cat", "sat". Before the block begins, the model has already turned those tokens into a hidden-state matrix. That just means three rows, one row per token, and each row is a vector of learned numbers. The important part is that the block does not receive English words. It receives those rows. Every operation we talk about is going to read those rows, reshape its view of them, or add new evidence back into them.`,

  `Maya: I like starting with the rows, but I want to challenge the word "evidence." A row is just numbers. Evidence for what? Evidence about the word itself, the sentence so far, or the next word?`,

  `Leo: All three, but at different moments. At the start, the row already carries token identity and position. The row for "cat" says, in a learned numerical language, something like: this position contains a token related to cat, it sits after "the", and it has whatever features earlier processing has created. Inside the block, that row gets updated so it can carry context. By the time the final layers are done, the last useful row helps the output head score the next token. So "evidence" means information that can change the model's next-token scores.`,

  `Maya: So when the row changes, prediction changes because the row is what later becomes the basis for logits. But how does one block know what evidence is missing?`,

  `Leo: It does not know in the human sense. It has learned weights. Those weights implement two kinds of work. Attention lets each token row pull information from other token rows. The MLP lets each row transform its own internal features. Residual connections keep the old stream available while those updates are added. Layer normalization keeps the inputs to each sublayer numerically steady. The block is not a black box blob. It is a sequence of very specific edits to the same table.`,

  `Maya: I want to slow down at attention. Suppose the current row is for "cat". What question is that row asking other rows?`,

  `Leo: It depends on the learned query vector for the cat row. A query is a learned way to ask, "What information would help this position right now?" The keys are learned ways for every row to advertise what they contain. The cat query is compared with all the keys. If the key for "sat" lines up strongly, the cat position may borrow information from "sat". If the key for "the" lines up in a different way, it may borrow determiner information or syntactic context. The dot products produce scores, one score for each possible source row.`,

  `Maya: But that sounds like matching labels. Is it literally saying cat looks for verb, or is that too human?`,

  `Leo: Too human if we take it literally, useful if we treat it as an analogy. The vectors do not contain English labels like "verb". They contain learned directions. During training, directions that helped prediction got reinforced. So a high dot product means the model has learned that this asking pattern and this advertising pattern are compatible. We can describe the result in human terms, but the actual mechanism is vector alignment.`,

  `Maya: Then the formula is not just decoration. Q times K transpose creates the score table. Why do we divide by the square root of d sub k before softmax?`,

  `Leo: Because dot products get larger when vectors have more dimensions. If the score numbers get too large, softmax becomes overconfident too early. One row gets nearly all the weight, and the model loses the ability to compare several possible sources. Dividing by the square root of the query-key width keeps the scores in a range where softmax can still make a graded choice. It is like turning the volume down before feeding a signal into a very sensitive amplifier.`,

  `Maya: Nice. So softmax is the amplifier?`,

  `Leo: Softmax is more like a normalizer that turns scores into a budget. For one destination token, it takes all the source-token scores and creates positive weights that add up to one. If "cat" gives weight point seven to "sat" and point two to "the", then the attention output for "cat" will be mostly the value vector from "sat", with some value vector from "the", plus whatever small weights remain for other rows.`,

  `Maya: That makes the value matrix different from the score matrix. Q and K decide where to read. V contains what gets read. Is that the mistake people make?`,

  `Leo: Exactly. A common misconception is thinking Q, K, and V are three separate facts from the tokenizer, or that the softmax weights themselves contain the content. They do not. Q, K, and V are learned projections of the current hidden state. The weights say how much to read from each source row. The value rows are the content being mixed. If you remember one thing, remember this separation: Q asks, K matches, V carries.`,

  `Maya: Now connect that to the hidden-state row. After the weighted sum of values is computed, where does it go?`,

  `Leo: It becomes an attention update. In the common pre-norm block pattern, the model first normalizes the current hidden-state matrix, computes attention from that normalized view, and then adds the attention result back to the original stream. Spoken in words, H after attention equals H input plus the attention update computed from layer-normalized H input. The plus sign matters. Attention does not replace the row. It contributes a delta.`,

  `Maya: Why is add-not-replace such a big design choice? If attention found useful context, why not just use the attention output as the new row?`,

  `Leo: Because the attention output is only one kind of update. It might carry context from other positions, but the original row still contains token identity, position, and earlier features. Replacing the row would force attention to reproduce everything worth keeping. Adding lets the sublayer say, "Here is what I learned from context," while the residual path keeps the existing representation alive. Across many blocks, that makes the model easier to train and harder to accidentally wipe clean.`,

  `Maya: So the residual stream is like a working notebook that every block can annotate. But the notebook has a strict page size: same number of rows, same width.`,

  `Leo: Yes. That strict shape is what lets blocks stack. If H input is L rows by d model columns, then after attention it is still L by d model. After the MLP, still L by d model. The contents are richer, but the interface is stable. This is why you can build a deep transformer from repeated blocks. Every block receives the same kind of object and returns the same kind of object.`,

  `Maya: Where does the MLP enter? Attention already mixed context across tokens. What is left for a per-token network to do?`,

  `Leo: Attention decides what other rows should influence this row. The MLP transforms the row after that context has arrived. Think of attention as bringing relevant notes onto the desk. The MLP is the private reasoning pass over the notes now sitting on that desk. It expands the row into a wider feature space, applies a smooth gate called GELU, compresses it back to model width, and adds that update to the residual stream.`,

  `Maya: Why expand first? If the block must return to d model anyway, why temporarily go wider?`,

  `Leo: A wider hidden space gives the MLP more places to represent intermediate features. A small row might not have enough room to express all useful combinations directly. Expansion creates many candidate feature detectors. GELU lets some pass strongly, some pass weakly, and some fade out. Compression brings the result back to the width the next block expects. The important thing is that the MLP can create nonlinear feature interactions inside one token row.`,

  `Maya: Give me a concrete row-level story. Not a metaphor, an actual before-and-after intuition.`,

  `Leo: Suppose the row for "sat" has gathered context that the subject is "cat" and the phrase is simple past tense. The MLP might strengthen internal features that make animal-action patterns or past-tense continuation patterns more useful later. We should not claim a single neuron means exactly "past tense cat action", but we can say the MLP changes the row's internal feature mix. Later, when logits are computed, those changed features can raise scores for plausible continuations and lower scores for implausible ones.`,

  `Maya: That phrase "later, when logits are computed" is the bridge I needed. The block is not predicting directly, but it is shaping the evidence that prediction will use.`,

  `Leo: Correct. Each block is an evidence refinery. Attention adds cross-token evidence. The MLP adds per-token feature transformation. Residual connections preserve continuity. LayerNorm keeps the computation stable. After many blocks, the final hidden state is fed to the output head. The output head produces one raw score per vocabulary token. Those raw scores become probabilities. Better hidden states make better raw scores.`,

  `Maya: What would go wrong if I memorized the names but missed the causal chain?`,

  `Leo: You might say "attention helps the model focus" without knowing what is focused, or "the MLP stores facts" without knowing what object it transforms, or "residuals preserve information" without knowing what gets added to what. The causal chain keeps you honest. Hidden-state rows enter. Q and K create scores. Softmax makes weights. Weights mix V. The attention update is added. The MLP transforms each row and adds another update. The same shape exits. Later layers and the output head use that enriched state to score next tokens.`,

  `Maya: I want one more pass on why this helps next-token prediction. Imagine the phrase is "the cat sat on the". What does the block contribute toward predicting the next word?`,

  `Leo: The row positions can gather relationships. "Cat" and "sat" help establish an event. "On" changes what kind of continuation is likely. "The" suggests a noun phrase is coming. Attention lets the current positions read relevant earlier positions. The MLP turns those context-aware rows into sharper internal features. When the output head eventually scores vocabulary items, words like "mat", "floor", or "chair" may become more plausible than unrelated words. The block did not choose "mat" by itself. It made the representation more predictive.`,

  `Maya: Where do multiple heads fit in this story? We have been talking as if there is one attention pattern. Real transformers have several heads. Is that just parallel decoration, or does it change the mental model?`,

  `Leo: It changes the mental model in a useful way. A single attention head produces one score table and one value mixture pattern. Multiple heads let the block run several learned attention patterns at the same time. One head might strongly connect a noun to a verb. Another might track punctuation or phrase boundaries. Another might copy a nearby formatting pattern. We should not assign fixed human labels too confidently, but the mechanism is clear: each head gets its own query, key, and value projections, produces its own context update, and the block combines those head outputs before adding the attention update back to the residual stream.`,

  `Maya: So multi-head attention is not the model voting on one answer. It is more like several ways of reading the same table, then merging the readings.`,

  `Leo: Exactly. Imagine a group looking at the same sentence with different transparent overlays. One overlay marks which words refer to each other. One overlay marks local syntax. One overlay marks a repeated phrase pattern. The overlays are not the final answer. They become useful marks written back into each token row. After the heads are combined, the residual stream receives a single attention update with many kinds of context compressed back into model width.`,

  `Maya: I want to ask about LayerNorm again because it feels easy to skip. If layer normalization mostly stabilizes numbers, how does that matter for the learner's causal picture?`,

  `Leo: It matters because every sublayer is sensitive to scale. If one row has much larger values than another, dot products and MLP activations can be dominated by magnitude rather than useful direction. LayerNorm normalizes each token row so the sublayer reads a steadier version of the current state. It does not erase the learned content. It makes the next computation less brittle. A good analogy is adjusting the lighting before taking a photo. You are not changing the object you want to photograph. You are making the conditions consistent enough that the camera can see it clearly.`,

  `Maya: Then there are really two paths at each sublayer: the normalized read path and the residual carry path.`,

  `Leo: Yes. That is a strong way to say it. The sublayer reads a normalized view to compute an update. The residual path carries the continuing state forward. The plus sign joins them. This explains why the formula is not just algebra. It names two responsibilities: compute a useful delta from a stable view, and preserve the stream that carries accumulated evidence.`,

  `Maya: What about training? We keep explaining inference, but these weights were learned somehow. Does the block structure help learning too?`,

  `Leo: Very much. During training, the model predicts next tokens, compares its predicted distribution with the real next token, and uses backpropagation to adjust weights. Residual paths help gradients flow through deep stacks because there is a direct route through the additions. LayerNorm keeps activations better behaved. Attention and MLP weights learn updates that reduce prediction error. You do not need the full training math to understand this lesson, but it helps to know that the block design is not only expressive during inference. It is also trainable at depth.`,

  `Maya: That makes residuals feel less like a random engineering trick. They preserve information in the forward pass and keep learning signals from dying in the backward pass.`,

  `Leo: Exactly. In the forward pass, residuals preserve and enrich the hidden state. In the backward pass, they provide easier gradient routes. That double role is one reason the same pattern appears again and again in deep networks. For this lesson, the forward-pass intuition is enough: the model keeps a stable stream and adds learned improvements to it.`,

  `Maya: Let me test the causal chain with a wrong version. If I say, "The token becomes Q, K, and V, attention picks the best word, the MLP stores the answer, and then the model predicts," what would you fix?`,

  `Leo: Several things. The token does not directly become Q, K, and V. The current hidden-state row is projected into Q, K, and V. Attention does not simply pick the best word. It produces weights over token positions and mixes value rows. The MLP does not store the answer in that moment. It transforms each context-aware row through learned nonlinear features. And the block itself does not necessarily predict immediately. It returns an enriched hidden-state matrix that later blocks and the output head use.`,

  `Maya: So the corrected version is more precise: hidden-state rows are projected into query, key, and value views; query-key scores become weights; weights mix values into attention updates; residual addition preserves and enriches the stream; the MLP adds a per-token nonlinear update; later the output head turns final hidden states into logits.`,

  `Leo: Perfect. And once you can say that in your own words, formulas become less intimidating. Q times K transpose divided by the square root of d sub k is not a spell. It is the score table. Softmax is not magic. It is turning each score row into a weight budget. Multiplying by V is not a mystery. It is using the budget to mix content rows. The residual equations are not decoration. They tell you the update is added, not substituted.`,

  `Maya: I also want to connect this to why wrong predictions happen. If the model predicts a weird next word, where in this chain could the representation have gone wrong?`,

  `Leo: Many places. The tokenizer may split text awkwardly. Earlier blocks may fail to represent a dependency. An attention head may put too much weight on a misleading token. The MLP may amplify a feature that fits a common pattern but not this context. The output head may give high logits to a fluent but false continuation. The value of this block-level understanding is that "the model was wrong" stops being a single foggy event. You can ask which representation, score, weight, update, or final logit made the mistake plausible.`,

  `Maya: That is useful for debugging our own thinking too. Instead of saying "attention understands context," we can ask exactly which token rows exchanged information and what changed because of it.`,

  `Leo: Yes. That is the culture I want this lesson to build: do not worship the term. Follow the object. If the object is a matrix, ask which rows and columns matter. If there is a score, ask what got compared. If there is a probability, ask what scores were normalized. If there is a residual add, ask what old signal stayed and what new update arrived. That is how the transformer block becomes inspectable.`,

  `Maya: That also explains why the visualization should move. If the audio says Q and K compare, I should see a score grid. If it says softmax weights mix V, I should see values being weighted. If it says residual add, I should see the old row plus the update, not a generic pipeline box.`,

  `Leo: Exactly. The visual should track the changing object. During the Q and K section, the object is a score table. During softmax and V, the object is a set of weights multiplying value rows. During residual addition, the object is the old hidden row plus a delta. During the MLP, the object is one row expanding, being gated, and compressing. A good visual does not decorate the transcript. It proves each step.`,

  `Maya: Let me summarize in my own words, and you can correct it. A transformer block receives a hidden-state matrix. Attention builds query, key, and value views from it. Query-key comparisons create routing weights. Those weights mix values into a context update. The update is added back to the residual stream. Then the MLP transforms each row independently and adds another update. The shape stays the same, but the rows carry better evidence for predicting what comes next.`,

  `Leo: That summary is right. The only correction is a nuance: layer normalization usually happens before each sublayer in modern pre-norm blocks, so attention and the MLP read normalized views while the residual stream carries the continuing state. If you keep that nuance, the whole block becomes less mysterious. It is not a pile of magic names. It is a disciplined way to refine a matrix of token-row evidence without losing the thread.`,
]);

const qkvTranscript = dialogue([
  `Leo: Let's make Q, K, and V feel like mechanics instead of initials. Start with one hidden-state row, maybe the row for "cat". Attention does not compare the raw row directly. It projects that row into a query, a key, and a value. These are learned views of the same row.`,
  `Maya: Why split one row into three views? If the row already contains information, why not compare it as-is?`,
  `Leo: Because attention has three jobs. The query asks what this position is looking for. The key advertises what each position can match against. The value carries the content that can be copied or blended if a match is useful. Asking, being found, and carrying content are related, but they are not the same job. Separate learned projections let the model tune them differently.`,
  `Maya: How exactly should I picture that split without pretending the vectors are English sentences?`,
  `Leo: Think of it like using the same source document to make three index cards. One card is a question card, one is a catalog card, and one is the excerpt you might actually quote. The cards come from the same document, but they are optimized for different uses. In attention, learned projections make those cards as vectors.`,
  `Maya: So when people say attention is a weighted average, the weights come from Q and K, but the average is over V. Is that the clean split?`,
  `Leo: Exactly. Q and K build the score table. V is what gets mixed. For one destination row, its query is dotted with every source row's key. Those dot products become raw relevance scores. After scaling and softmax, the scores become weights. Then those weights multiply value rows and sum them into the attention output.`,
  `Maya: What does the scaling actually prevent? I know the formula says divide by the square root of d sub k, but I want the behavior.`,
  `Leo: Wider query-key vectors tend to produce larger dot products. Large raw scores can make softmax too sharp, almost like it has already decided before comparing carefully. Scaling keeps the score range calmer. That lets softmax distribute weight across multiple useful rows when the evidence calls for it.`,
  `Maya: Give me a tiny example.`,
  `Leo: Suppose the row for "cat" scores three source tokens: "the" gets 1.0, "cat" gets 0.2, and "sat" gets 2.4 after scaling. Softmax may assign most weight to "sat", some to "the", and little to "cat". The attention output for the cat position then becomes a blend of the value rows, mostly the value row for "sat".`,
  `Maya: That feels counterintuitive. Why would the cat row read from sat?`,
  `Leo: Because prediction often depends on relationships, not isolated identity. If the model is building a representation of a sentence, the noun and verb inform each other. The cat row might need action context. The sat row might need subject context in another head. Attention lets token positions exchange useful information before the next prediction is scored.`,
  `Maya: What is the easiest mistake here?`,
  `Leo: Thinking the softmax weights are the content. They are not. They are routing numbers. Another mistake is thinking V decides where to attend. It does not. V carries what will be read once Q and K decide how much to read. In a visual, you should see Q and K forming a score grid, softmax turning a row of scores into weights, and those weights pulling value rows into a mixed context vector.`,
  `Maya: How does that mixed vector improve prediction rather than just making the row look busier?`,
  `Leo: Because it changes what evidence sits at the destination position. If the cat row now includes action evidence from the sat row, later computations can score continuations using both identity and relation. The row is not busier in a random way. It has imported information that training found useful for predicting next tokens.`,
  `Maya: Can you go deeper on the causal chain from one high query-key score to one changed next-token probability?`,
  `Leo: A high query-key score raises a softmax weight. That weight increases how much of a value row enters the attention output. The attention output is added to the residual stream. Later blocks and the output head read that changed stream. If the imported value evidence supports a likely continuation, the corresponding logit can rise. That is the chain: score, weight, value mixture, residual update, later logit.`,
  `Maya: And that context vector is not the final answer. It is an update to the hidden state.`,
  `Leo: Right. Attention produces a context-mixing update. The residual path adds that update back into the stream, so the token row now carries both its previous evidence and the newly gathered cross-token evidence.`,
]);

const residualTranscript = dialogue([
  `Leo: The residual stream is the continuity path through the transformer. A block does not erase the hidden-state matrix and replace it with a brand new one. It computes updates and adds them to the stream.`,
  `Maya: Why is addition so central? If attention and the MLP are powerful, why preserve the old row?`,
  `Leo: Because an update is not the whole representation. Attention might add context from other tokens. The MLP might add a nonlinear per-token feature update. But the original row still carries useful token identity, position, and prior-layer evidence. Residual addition lets a sublayer contribute without forcing it to recreate everything worth keeping.`,
  `Maya: So the residual stream is like a shared notebook where each sublayer adds notes, but nobody tears out the previous page.`,
  `Leo: Exactly, with one strict rule: the page size stays the same. If the incoming matrix has L token rows and d model columns, the post-attention matrix has the same shape. The post-MLP matrix also has the same shape. That shape stability is why blocks can be stacked deeply.`,
  `Maya: Where does LayerNorm fit? I see formulas like H after attention equals H input plus attention of layer-normalized H input. Why normalize the thing you read but add back to the original stream?`,
  `Leo: Normalization gives the sublayer a stable input scale. The attention or MLP computation gets a clean view. The residual path keeps the continuing state. So the sublayer reads a normalized version, computes an update, and the update is added to the stream that carries history forward.`,
  `Maya: What changes in one row after the attention residual add?`,
  `Leo: Suppose the row for "cat" receives an attention update that includes information from "sat". Before the add, the row mostly carries the current representation of the cat position. After the add, it still represents the cat position, but now with action context mixed in. It is the same address in the matrix, with richer contents.`,
  `Maya: Then the MLP does the same kind of residual move, but without reading other tokens?`,
  `Leo: Yes. The MLP reads each normalized row separately, expands it, gates it, compresses it, and returns a same-width update. That update is added to H after attention. Spoken in words: H output equals H after attention plus the MLP update computed from layer-normalized H after attention.`,
  `Maya: The mistake would be thinking residuals are just a training trick off to the side.`,
  `Leo: Right. They help training, but they are also the main information highway. If the visual is good, it should show the old stream, the sublayer update, and the addition. The old signal remains visible while the update arrives. That is the point: preserve and enrich, not replace.`,
]);

const mlpTranscript = dialogue([
  `Leo: The MLP is the part of the transformer block that works on each token row by itself. Attention lets rows talk to other rows. The MLP asks: now that this row has context, what internal features should be strengthened, weakened, or recombined?`,
  `Maya: If it only sees one row, is it fair to call it useful for language understanding? It sounds isolated.`,
  `Leo: It is isolated at this step, but the row is no longer context-free. Attention has already written cross-token information into it. So the MLP receives a row that may know something about neighboring words, grammar, topic, or long-range dependencies. It transforms that context-aware row internally.`,
  `Maya: Walk through the shape. What enters, what expands, what comes back?`,
  `Leo: One row of width d model enters. The first linear layer projects it into a wider space, often around four times wider. GELU applies a smooth gate. The second linear layer compresses the result back to d model. The MLP output has the same width as the original row so it can be added back into the residual stream.`,
  `Maya: Why not stay at d model the whole time?`,
  `Leo: Expansion gives the network room to represent intermediate feature combinations. Think of a small workbench that unfolds into a larger table while you sort parts. The final object still has to fit back through the original doorway, but the temporary wider space lets the model test and combine more features before compressing the update.`,
  `Maya: How does compression avoid throwing away the useful work from the wider space?`,
  `Leo: The compression matrix is learned too. It does not keep every intermediate signal separately. It learns how to combine the useful activated features back into a same-width update. If expansion is where many candidate signals become visible, compression is where the model packages the useful pattern so the residual stream can carry it forward.`,
  `Maya: And GELU is the gate on that larger table?`,
  `Leo: Yes. GELU lets strong positive features pass mostly through, suppresses strongly negative features, and treats near-zero features smoothly. It is less like an on-off switch and more like a dimmer. That smoothness helps optimization and lets weak evidence contribute by degree.`,
  `Maya: Give me a row-level story tied to prediction.`,
  `Leo: Imagine the row has context that the phrase is "the cat sat on the". The MLP may strengthen features related to physical locations, simple past tense, or noun-phrase continuation. We should not pretend one feature has a perfect English label, but the effect is real: the row's internal evidence changes. Later, the output head can use that changed evidence to score next tokens like "mat" or "floor" more strongly than unrelated tokens.`,
  `Maya: How exactly can a per-token transformation affect a next-token distribution if it never directly compares candidate words?`,
  `Leo: The MLP changes the hidden features that the output head will later read. The output head is a learned mapping from hidden-state features to vocabulary logits. If the MLP strengthens features that correlate with a location noun after "sat on the", then the output head can convert those stronger features into higher scores for location-like tokens.`,
  `Maya: What changes inside the row when GELU suppresses one intermediate feature but lets another through?`,
  `Leo: The expanded vector contains many candidate intermediate signals. GELU scales each signal by its value. Strong useful signals survive, weak uncertain signals contribute a little, and negative signals fade. After compression, the surviving pattern becomes a same-width update that is added back to the residual stream.`,
  `Maya: Can you go deeper on the mistake people make when they say the MLP is where facts live?`,
  `Leo: That phrase points at something real but can mislead. MLP weights are believed to store lots of learned associations, but during inference the MLP is not opening a database record labeled fact. It is applying learned transformations to the current row. A better statement is: MLPs can express stored associations and feature transformations when the current context activates them.`,
  `Maya: So the MLP does not choose the next token. It changes the representation that later scoring uses.`,
  `Leo: Exactly. The common mistake is saying "attention handles context and the MLP stores facts" as if those were separate boxes. A better view is: attention writes relevant context into the row, the MLP performs nonlinear feature work on that row, and the residual stream carries the updated row forward. The output head eventually turns the final row into logits.`,
  `Maya: Why does the residual add matter after the MLP specifically?`,
  `Leo: Because the MLP output is still an update, not a replacement representation. The row before the MLP already contains token identity and attention context. The MLP contributes a feature transformation on top of that. Adding it back keeps the old evidence and the new nonlinear feature work in the same stream.`,
  `Maya: What should the visual show while this audio plays?`,
  `Leo: It should show one token row entering, expanding into a wider hidden space, passing through a GELU gate, compressing back to the original width, and then being added as a residual update. If the visual only shows a box labeled MLP, it misses the thing that matters: temporary expansion, smooth gating, compression, and same-shape handoff.`,
]);

const transcriptsByTitle = new Map<string, string>([
  [OVERVIEW_TITLE, overviewTranscript],
  [QKV_TITLE, qkvTranscript],
  [RESIDUAL_TITLE, residualTranscript],
  [MLP_TITLE, mlpTranscript],
]);

async function main() {
  const args = process.argv.slice(2);
  const lessonIds = args
    .flatMap((arg, index) => (arg === "--lesson-id" ? [Number(args[index + 1])] : []))
    .filter((id) => Number.isFinite(id) && id > 0);
  const regenerateAudio = args.includes("--audio");
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const backupPath = `${dbPath}.before-transformer-natural-audio-${stamp}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`Backup written: ${backupPath}`);

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  const ids = lessonIds.length > 0 ? lessonIds : findTransformerLessons(db);
  if (ids.length === 0) throw new Error("No target lessons found");

  for (const lessonId of ids) {
    const updated = updateLessonTranscripts(db, lessonId);
    console.log(`lesson ${lessonId}: updated ${updated} transcript(s)`);
    if (regenerateAudio) {
      const result = await generateLessonAudio(db, lessonId, { force: true });
      console.log(`lesson ${lessonId}: audio ${result.status} ${result.durationSec ?? ""} ${result.relPath ?? ""}`);
    }
  }
  db.close();
}

function updateLessonTranscripts(db: Database.Database, lessonId: number): number {
  const rows = db
    .prepare("SELECT id, title, activity_type, content FROM lesson_activities WHERE lesson_id = ? ORDER BY sequence_order")
    .all(lessonId) as ActivityRow[];
  const update = db.prepare("UPDATE lesson_activities SET content = ?, updated_at = datetime('now') WHERE id = ?");
  let count = 0;
  for (const row of rows) {
    const transcript = row.title ? transcriptsByTitle.get(row.title) : undefined;
    if (!transcript) continue;
    const content = JSON.parse(row.content);
    if (row.activity_type === "audio") {
      content.script = transcript;
      content.transcript = transcript;
      content.duration_hint = Math.max(Number(content.duration_hint ?? 0), 900);
    } else if (row.activity_type === "lesson_part") {
      content.audio = content.audio ?? {};
      content.audio.script = transcript;
      content.audio.transcript = transcript;
    } else {
      continue;
    }
    update.run(JSON.stringify(content), row.id);
    count += 1;
  }
  return count;
}

function findTransformerLessons(db: Database.Database): number[] {
  return (db
    .prepare("SELECT id FROM lessons WHERE title = 'Inside the Attention Block: Q, K, V, MLP, and the Residual Stream' ORDER BY id")
    .all() as Array<{ id: number }>).map((row) => row.id);
}

function resolveDbPath(): string {
  const explicit = process.env.AVOCADOCORE_DB_PATH;
  if (explicit) return explicit;
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith("file:")) return databaseUrl.slice("file:".length);
  if (databaseUrl) return databaseUrl;
  return path.join(process.cwd(), "data", "avocadocore.db");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
