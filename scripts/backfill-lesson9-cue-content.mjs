/**
 * Replace Lesson 9 cue narration/headline with content-aligned text (better
 * captions), keeping the already-rescaled cue WINDOWS unchanged.
 *
 * The proportional rescale (backfill-lesson9-cue-timing-rescale.mjs) fixed the
 * timing but left the generic placeholder narration ("Locate the lesson before
 * details for Code It From Scratch…"), which makes poor VTT captions. This
 * writes narration that matches each cue's authored Manim scene AND the recorded
 * audio, following the L12/13/14 precedent. Spatial dims are the lesson's real
 * Gemma-4 target (1,3,896,896), matching the orientation + permute audio.
 *
 * Windows are NOT touched (start/end preserved) so the pinned scene cue_duration
 * values still line up. Run under node 22 after a DB backup:
 *   AVOCADOCORE_DB_PATH=<live> node scripts/backfill-lesson9-cue-content.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";

// activity → path to the cues container in its content JSON
const SEGMENTS = {
  59: { path: ["orientation_visual"], cues: [
    ["High-level map", "A raw image file becomes a model-ready tensor in seven lines",
     "A raw image file becomes a model-ready tensor in exactly seven lines of PIL and NumPy — the goal is a (1, 3, 896, 896) float32 tensor for the Gemma 4 vision encoder."],
    ["Analogy", "Think of it as a seven-station assembly line",
     "Think of the pipeline as a seven-station assembly line: open, resize, arrayify, floatify, normalize, permute, and batch — each station does exactly one job, then hands off."],
    ["Tiny example", "Follow one tiny image through every step",
     "Follow one tiny image through all seven steps and watch its shape, dtype, and value range change at every row of the table."],
    ["Mechanism", "Three things change: shape, dtype, range",
     "Three things change along the way: shape goes (H,W,C) to (C,H,W) to (1,C,H,W), dtype goes uint8 to float32, and range goes 0-255 to 0-1 to normalized."],
    ["Implementation", "The seven real lines, and how to test them",
     "These are the seven real lines lit one at a time; the one formula is per-channel normalization, and you test with assert arr.shape == (1, 3, 896, 896) and arr.dtype == float32."],
    ["Misconception", "Separate the traps that look almost right",
     "Separate the traps: PIL uses (Width, Height) not (H, W); dividing a uint8 array by 255 without first casting gives float64, which wastes twice the memory, so cast to float32 first; and normalize before you permute, not after."],
    ["Synthesis", "Seven stations, one tensor — now code it yourself",
     "Seven stations, one tensor: open, resize, array, float, normalize, permute, batch. Preprocessing is the contract between messy real files and the model's exact numeric input."],
  ]},
  60: { path: ["audio", "synced_visual"], cues: [
    ["Input", "Image.open a picture becomes a grid of pixels",
     "Image.open(path).convert('RGB') loads any format and forces exactly three channels; inspect .size, but note PIL reports (Width, Height) — the reverse of NumPy's (H, W, C)."],
    ["Transform", "img.resize to the fixed shape the model expects",
     "img.resize((896, 896)) resamples the image to the model's fixed spatial shape; like .size, resize takes its argument in (Width, Height) order."],
    ["Handoff", "np.asarray hands NumPy a uint8 (896, 896, 3) array",
     "np.asarray(img) hands NumPy a uint8 array of shape (896, 896, 3) with channels last — and no arithmetic happens until the dtype becomes float32."],
  ]},
  61: { path: ["audio", "synced_visual"], cues: [
    ["Input", "Pixels arrive as integers 0-255; models want floats",
     "Pixels arrive as uint8 integers from 0 to 255, but models need floats — dividing a uint8 array by 255 gives correct values in 0 to 1 but as float64, which wastes twice the memory, so call astype(float32) before dividing."],
    ["Transform", "astype(float32)/255, then (arr - mean)/std",
     "arr.astype(np.float32)/255 maps 0-255 into 0-1; then (arr - mean)/std applies the length-3 ImageNet mean and std, broadcast across every pixel, to center each channel near zero."],
    ["Handoff", "A float32 array, roughly zero-mean per channel",
     "The result is a float32 array, still shaped (896, 896, 3) but now roughly zero-mean per channel: the shape is unchanged while the dtype and range have changed."],
  ]},
  62: { path: ["audio", "synced_visual"], cues: [
    ["Input", "NumPy gives H-W-C; frameworks want C-H-W",
     "NumPy hands us (896, 896, 3) with channels last, but PyTorch and the Gemma 4 encoder expect channels first — the array is right, the axis order is wrong, so we reorder axes."],
    ["Transform", "transpose(2,0,1) to CHW, then add the batch dim",
     "arr.transpose(2, 0, 1) reorders the axes to (3, 896, 896), channels first; then arr[None, ...] adds a leading batch dimension to make (1, 3, 896, 896)."],
    ["Handoff", "A (1, 3, 896, 896) float tensor, ready for the model",
     "The finished tensor is (1, 3, 896, 896) float32 — normalized, channels-first, and batched — ready to feed straight into the model with no more preprocessing."],
  ]},
};

const db = new Database(DB_PATH);
const now = new Date().toISOString();
let total = 0;
const tx = db.transaction(() => {
  for (const [actId, spec] of Object.entries(SEGMENTS)) {
    const row = db.prepare("SELECT content FROM lesson_activities WHERE id=?").get(+actId);
    if (!row) throw new Error(`activity ${actId} not found`);
    const content = JSON.parse(row.content);
    let container = content;
    for (const p of spec.path) container = container[p];
    const cues = container.cues;
    if (!Array.isArray(cues) || cues.length !== spec.cues.length) {
      throw new Error(`activity ${actId}: expected ${spec.cues.length} cues, found ${cues?.length}`);
    }
    cues.forEach((cue, i) => {
      const [label, headline, narration] = spec.cues[i];
      cue.label = label;
      cue.headline = headline;
      cue.narration = narration;
      total++;
    });
    container.cue_content_authored_at = now;
    db.prepare("UPDATE lesson_activities SET content=?, updated_at=? WHERE id=?")
      .run(JSON.stringify(content), now, +actId);
    console.log(`activity ${actId}: rewrote ${cues.length} cue narrations (windows untouched)`);
  }
});
tx();
console.log(`done: ${total} cue narrations content-aligned across ${Object.keys(SEGMENTS).length} segments`);
db.close();
