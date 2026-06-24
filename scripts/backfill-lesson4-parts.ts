#!/usr/bin/env tsx
import { getDb, closeDb } from "../src/db/connection";

type Difficulty = "easy" | "medium" | "hard";

interface Question {
  id: string;
  concept: string;
  difficulty: Difficulty;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  misconception_target: string;
  rephrase_instructions: string;
}

interface PartSpec {
  title: string;
  part_id: string;
  concept: string;
  intro: string;
  metaphor: string;
  why: string;
  example: string;
  skip: string;
  summary: string;
  audio: string;
  questions: Question[];
}

function q(
  id: string,
  concept: string,
  difficulty: Difficulty,
  question: string,
  choices: string[],
  correct_index: number,
  explanation: string,
  misconception_target: string
): Question {
  return {
    id,
    concept,
    difficulty,
    question,
    choices,
    correct_index,
    explanation,
    misconception_target,
    rephrase_instructions:
      "Rephrase with a simple everyday analogy. Preserve the same concept and do not reveal the answer in the question.",
  };
}

const PARTS: PartSpec[] = [
  {
    title: "Part 1: Resize fixes the canvas",
    part_id: "resize",
    concept: "image-preprocessing-resize",
    intro:
      "Resize is the shape contract between a real-world image and a model that was trained on fixed-size examples.",
    metaphor:
      "Think of the model as a scanner with a fixed tray. A receipt, passport photo, and poster can all be scanned only after they are placed into the tray size the scanner expects.",
    why:
      "A multimodal model usually expects image tensors with a fixed height and width. Resize makes every image fit that expected spatial canvas before any later numerical steps happen.",
    example:
      "A 3024 by 4032 phone photo cannot be stacked with a 640 by 480 screenshot in one tensor batch. After resize, both can become 224 by 224 images, so the rest of the pipeline can treat them consistently.",
    skip:
      "If resize is skipped, the model may reject the tensor shape, batching may fail, or a later crop/pad step may silently compare images at different scales.",
    summary:
      "Resize does not make the image more truthful. It makes the image fit the spatial shape the model was trained to read.",
    audio:
      "This visualization is about the canvas contract. Start with the original width and height controls. When the image is large, notice that the model input area stays fixed. The point is not that 224 by 224 is magical. The point is that the model's first image layers were trained to receive a predictable spatial grid. Resize is like placing every paper onto the same scanner tray. A phone photo, a screenshot, and a product image can all contain useful information, but the model cannot batch them together until their height and width agree. In the visual, move the original size away from the target and watch the mismatch grow. That mismatch is what causes shape errors or inconsistent downstream comparisons. Then move the target size and notice how the later pipeline gets a stable canvas again. The thing to remember is: resize fixes where pixels live, not what their numeric values mean.",
    questions: [
      q("resize-q1", "image-preprocessing-resize", "easy", "What problem does resizing mainly solve?", ["It converts RGB to BGR", "It makes images share the expected height and width", "It subtracts the ImageNet mean", "It adds a batch dimension"], 1, "Resize is about the spatial canvas: height and width.", "Confuses resize with numeric normalization"),
      q("resize-q2", "image-preprocessing-resize", "easy", "Why can two unresized images be hard to batch together?", ["They may have different shapes", "They always have different color spaces", "They cannot be represented as arrays", "They lose all labels"], 0, "A tensor batch needs compatible dimensions.", "Misses the batching shape constraint"),
      q("resize-q3", "image-preprocessing-resize", "medium", "A model was trained on 224x224 images. A 1024x768 image arrives. What is the resize step doing?", ["Changing the class label", "Mapping the image onto the trained input canvas", "Normalizing channels to zero mean", "Moving channels before height"], 1, "Resize maps the image to the spatial size the model expects.", "Treats resize as semantic labeling"),
      q("resize-q4", "image-preprocessing-resize", "medium", "What can break if resize is skipped?", ["The tensor may have a shape the model does not accept", "Pixel values become negative automatically", "The model forgets its weights", "The file extension changes"], 0, "The immediate failure is often incompatible tensor shape.", "Over-focuses on unrelated file details"),
      q("resize-q5", "image-preprocessing-resize", "medium", "In the scanner-tray metaphor, what is the tray?", ["The model's expected input size", "The correct answer label", "The audio transcript", "The optimizer"], 0, "The tray is the fixed spatial size the model expects.", "Cannot map metaphor to model input"),
      q("resize-q6", "image-preprocessing-resize", "hard", "Why is resize done before batching?", ["Batches require examples with compatible tensor dimensions", "Batching changes the image's aspect ratio", "Batching computes ImageNet means", "Batching removes color channels"], 0, "A batch stacks examples, so the dimensions must line up first.", "Misses tensor stacking requirement"),
      q("resize-q7", "image-preprocessing-resize", "hard", "What does resize NOT guarantee?", ["A compatible spatial size", "That the important object is preserved perfectly", "A fixed height", "A fixed width"], 1, "Resize can distort or lose detail; it only guarantees the spatial contract.", "Overtrusts preprocessing as semantic preservation"),
      q("resize-q8", "image-preprocessing-resize", "medium", "If every image is already the expected size, resize is still best understood as what?", ["A shape contract check", "A language translation", "A loss function", "A label encoder"], 0, "Even when no change is needed, the concept is the shape contract.", "Does not identify the invariant"),
      q("resize-q9", "image-preprocessing-resize", "easy", "Which dimensions does resize primarily change?", ["Height and width", "Batch and class count", "Learning rate and loss", "Mean and standard deviation"], 0, "Resize changes the spatial dimensions.", "Confuses dimensions and statistics"),
      q("resize-q10", "image-preprocessing-resize", "hard", "Why can inconsistent image sizes lead to misleading comparisons even before an explicit crash?", ["Features may represent objects at inconsistent scales", "All pixels become exactly zero", "The model switches to text mode", "The GPU disables gradients"], 0, "Different scales can make similar objects occupy different proportions of the input grid.", "Assumes only hard crashes matter"),
    ],
  },
  {
    title: "Part 2: Rescale fixes the units",
    part_id: "rescale",
    concept: "image-preprocessing-rescale",
    intro:
      "Rescale changes the unit of measurement from byte-sized pixel counts to floating-point proportions.",
    metaphor:
      "It is like switching from cents to dollars before doing finance math. The amount is related, but the unit is different.",
    why:
      "Most model preprocessing formulas expect pixel channels as floats in 0.0 to 1.0. Dividing uint8 values by 255 turns 0 to 255 byte values into that unit.",
    example:
      "A red channel value of 128 means about half intensity. After rescale, it becomes roughly 0.502, which is the scale expected by the mean/std normalization formula.",
    skip:
      "If rescale is skipped, subtracting ImageNet mean values like 0.485 from pixel values like 128 mixes incompatible units. The normalized values become enormous and meaningless.",
    summary:
      "Rescale fixes the measuring unit. It must happen before subtracting small 0-to-1 means.",
    audio:
      "This visualization is about units. Move the pixel value slider and compare the raw uint8 value with the rescaled float. A value like 128 feels ordinary in image files because files store color channels as integers from 0 to 255. But the normalization constants used by ImageNet models, like 0.485 and 0.229, are not in that 0 to 255 unit. They live in the 0.0 to 1.0 unit. So dividing by 255 is not a random formula. It is the unit conversion that makes the next formula legal. The finance metaphor is cents and dollars: subtracting 48 cents from 128 dollars is nonsense if the amounts are not in the same unit. In the visual, watch how 255 becomes 1.0 and 0 stays 0.0. The takeaway is: rescale fixes the number system before normalization tries to interpret the numbers.",
    questions: [
      q("rescale-q1", "image-preprocessing-rescale", "easy", "What does dividing by 255 do?", ["Converts 0-255 pixels into 0.0-1.0 floats", "Changes RGB into text", "Adds a batch axis", "Finds the class label"], 0, "Dividing by 255 rescales uint8 pixel values into float proportions.", "Confuses rescale with other preprocessing steps"),
      q("rescale-q2", "image-preprocessing-rescale", "easy", "Why is 128/255 about 0.5?", ["128 is roughly half of 255", "128 is the ImageNet mean", "255 is the number of channels", "0.5 is the batch size"], 0, "The rescaled value is the proportion of maximum channel intensity.", "Misses unit conversion"),
      q("rescale-q3", "image-preprocessing-rescale", "medium", "Why should rescale happen before ImageNet normalization?", ["The means/stds are defined on 0.0-1.0 values", "The means/stds resize the image", "Normalization creates RGB channels", "Normalization requires strings"], 0, "ImageNet mean and std constants assume rescaled floats.", "Applies formulas without checking units"),
      q("rescale-q4", "image-preprocessing-rescale", "medium", "What unit are raw uint8 image pixels usually stored in?", ["Integers from 0 to 255", "Meters", "Probabilities from -1 to 1", "Batch indices"], 0, "Typical image files store channel intensity as 0-255 integers.", "Does not know raw pixel storage"),
      q("rescale-q5", "image-preprocessing-rescale", "medium", "What goes wrong if you subtract 0.485 directly from 128?", ["You mix 0-1 constants with 0-255 pixels", "You resize the image twice", "You remove the red channel", "You create a valid normalized value"], 0, "The units do not match, so the result is not the intended normalization.", "Unit mismatch blindness"),
      q("rescale-q6", "image-preprocessing-rescale", "hard", "What does rescale preserve conceptually?", ["Relative channel intensity", "Original integer dtype", "The batch dimension", "The final prediction"], 0, "A larger raw value remains a larger float; the unit changes.", "Thinks conversion destroys ordering"),
      q("rescale-q7", "image-preprocessing-rescale", "hard", "Which value should 255 map to after rescaling?", ["1.0", "255.0", "0.485", "-1.0"], 0, "255 is maximum channel intensity, so it maps to 1.0.", "Fails boundary mapping"),
      q("rescale-q8", "image-preprocessing-rescale", "easy", "In the cents-to-dollars metaphor, what is rescale?", ["Changing units before doing math", "Choosing the best stock", "Sorting examples into batches", "Cropping the image"], 0, "Rescale is the unit conversion step.", "Cannot connect metaphor"),
      q("rescale-q9", "image-preprocessing-rescale", "medium", "What data type is usually used after rescaling?", ["float32 or another float", "Only boolean", "Only string", "Only class id"], 0, "The model expects floating-point numeric tensors.", "Misses dtype change"),
      q("rescale-q10", "image-preprocessing-rescale", "hard", "Why is rescale separate from normalize?", ["Rescale changes units; normalize centers/spreads values using dataset stats", "They are identical names for resizing", "Normalize must happen first", "Rescale chooses labels"], 0, "Rescale and normalize solve different contracts.", "Collapses distinct preprocessing steps"),
    ],
  },
  {
    title: "Part 3: Normalize fixes the baseline",
    part_id: "normalize",
    concept: "image-preprocessing-normalize",
    intro:
      "Normalize tells the model how unusual a pixel channel is compared with the training distribution.",
    metaphor:
      "It is like grading a test relative to the class average and spread, not just reading the raw score.",
    why:
      "Pretrained ImageNet models learned from channels centered by ImageNet means and scaled by ImageNet standard deviations. Normalization puts new images into the same coordinate system.",
    example:
      "For red, a rescaled value of 0.485 becomes about 0 after subtracting the red mean and dividing by red std. A brighter red becomes positive; a darker red becomes negative.",
    skip:
      "If normalization is skipped, the model sees values in a coordinate system different from training. Activations can be shifted, making learned filters respond unreliably.",
    summary:
      "Normalize fixes the baseline and scale the pretrained model expects.",
    audio:
      "This visualization is about baseline, not brightness alone. Use the channel value control and watch the normalized output. When the red channel is around the ImageNet red mean, about 0.485 after rescaling, the normalized value is near zero. That means ordinary for the training set. Above the mean becomes positive. Below the mean becomes negative. Dividing by the standard deviation turns the difference into units of typical variation. The test-score metaphor helps: 80 out of 100 means something different in an easy class versus a hard class. Normalization says: compared with the data this model trained on, how unusual is this channel? If we skip this step, the model still receives numbers, but they are in the wrong coordinate system. The visual proves that normalization is not decoration. It aligns new images with the baseline the pretrained filters learned.",
    questions: [
      q("normalize-q1", "image-preprocessing-normalize", "easy", "What does normalization subtract?", ["The channel mean", "The batch size", "The image filename", "The class label"], 0, "Normalization subtracts the per-channel mean.", "Misses formula structure"),
      q("normalize-q2", "image-preprocessing-normalize", "easy", "What does normalization divide by?", ["The channel standard deviation", "The number of labels", "The height only", "The batch index"], 0, "After subtracting the mean, normalization divides by the channel std.", "Misses formula structure"),
      q("normalize-q3", "image-preprocessing-normalize", "medium", "Why use ImageNet means/stds for an ImageNet-pretrained model?", ["They match the model's training preprocessing", "They make all images 224x224", "They remove the need for RGB", "They are random constants"], 0, "The pretrained model learned under those statistics.", "Treats constants as arbitrary"),
      q("normalize-q4", "image-preprocessing-normalize", "medium", "What does a normalized value near 0 mean?", ["Near the training-set channel average", "The image is blank", "The model is wrong", "The pixel was 255"], 0, "Zero means close to the channel mean after centering.", "Misreads normalized zero"),
      q("normalize-q5", "image-preprocessing-normalize", "medium", "What does a positive normalized value usually mean?", ["Above the channel mean", "Invalid pixel", "Batch dimension missing", "The answer is correct"], 0, "Positive means the value is above the mean after scaling.", "Misreads sign"),
      q("normalize-q6", "image-preprocessing-normalize", "hard", "Why can skipping normalization hurt pretrained filters?", ["Inputs are shifted from the coordinate system learned during training", "It deletes the model weights", "It changes Python syntax", "It prevents resizing"], 0, "Filters expect activations produced by normalized inputs.", "Does not connect preprocessing to learned filters"),
      q("normalize-q7", "image-preprocessing-normalize", "hard", "Why does std matter, not just mean?", ["It expresses differences in units of typical variation", "It stores image width", "It chooses output classes", "It makes all values positive"], 0, "Dividing by std scales the centered value by typical spread.", "Ignores scale"),
      q("normalize-q8", "image-preprocessing-normalize", "easy", "Which step must happen before normalization with ImageNet means?", ["Rescale to 0.0-1.0", "Add final labels", "Create a loss function", "Upload to YouTube"], 0, "The means are defined for rescaled 0-1 channel values.", "Forgets unit precondition"),
      q("normalize-q9", "image-preprocessing-normalize", "medium", "In the class-grade metaphor, what is the mean?", ["The class average", "The student's name", "The room number", "The final prediction"], 0, "The mean is the average baseline.", "Cannot map metaphor"),
      q("normalize-q10", "image-preprocessing-normalize", "hard", "What contract does normalize satisfy?", ["The statistical input contract of the pretrained model", "The file extension contract", "The screen resolution contract", "The API auth contract"], 0, "Normalize matches the statistics the pretrained model expects.", "Cannot name the contract"),
    ],
  },
  {
    title: "Part 4: Permute fixes axis meaning",
    part_id: "permute",
    concept: "image-preprocessing-permute",
    intro:
      "Permute changes the order of dimensions so each axis means what the model code expects.",
    metaphor:
      "It is like putting address fields into the right columns: street, city, postal code. The same values in the wrong columns become nonsense.",
    why:
      "Many image libraries produce HWC arrays: height, width, channels. PyTorch vision models commonly expect CHW tensors: channels, height, width.",
    example:
      "A 224x224 RGB image may start as [224, 224, 3]. Permute turns it into [3, 224, 224], so convolution kernels read color channels as channels, not as width.",
    skip:
      "If permute is skipped, the model may interpret the color channel dimension as a spatial dimension or crash because the channel count is not where it expects.",
    summary:
      "Permute fixes the meaning of tensor axes. The numbers can be identical but arranged wrongly.",
    audio:
      "This visualization is about axis meaning. The same pixel values can be present, but if they are in the wrong dimension order, the model reads them incorrectly. Use the layout control to compare HWC and CHW. HWC is natural for many image tools because it says: for each row and column, store red, green, and blue. PyTorch convolution layers usually expect CHW because they want channels first, then the spatial grid. The address metaphor is useful: if someone writes a postal code in the city column, the characters are real, but the record is wrong. In the visual, watch how the shape labels move. The point is not that one layout is morally better. The point is that the model has a contract. Permute satisfies that contract by putting channels, height, and width in the expected order.",
    questions: [
      q("permute-q1", "image-preprocessing-permute", "easy", "What does permute change?", ["The order of tensor dimensions", "The image label", "The channel mean", "The audio voice"], 0, "Permute reorders axes.", "Confuses axis order with values"),
      q("permute-q2", "image-preprocessing-permute", "easy", "What does HWC stand for?", ["Height, width, channels", "Hue, white, contrast", "Header, weight, class", "Hidden, window, code"], 0, "HWC means height, width, channels.", "Does not know layout labels"),
      q("permute-q3", "image-preprocessing-permute", "easy", "What does CHW stand for?", ["Channels, height, width", "Class, hidden, weight", "Crop, hue, white", "Code, header, window"], 0, "CHW means channels, height, width.", "Does not know layout labels"),
      q("permute-q4", "image-preprocessing-permute", "medium", "Why do PyTorch vision models often need CHW?", ["Convolution layers expect channels first", "They cannot use RGB", "They require text inputs", "They always resize inside the model"], 0, "PyTorch conv layers commonly use channel-first tensors.", "Misses model layout contract"),
      q("permute-q5", "image-preprocessing-permute", "medium", "A tensor is [224, 224, 3]. What is likely missing before PyTorch model input?", ["Permute to [3, 224, 224]", "Normalize to [224, 3, 224]", "Delete the channels", "Convert labels to pixels"], 0, "The channel dimension should move first.", "Cannot transform shape"),
      q("permute-q6", "image-preprocessing-permute", "medium", "What can happen if channels stay in the last axis when the model expects first?", ["The model reads dimensions with the wrong meaning", "The image becomes automatically correct", "The batch dimension appears twice", "The file is uploaded"], 0, "Axis meaning is wrong even if the numbers are present.", "Thinks values alone are enough"),
      q("permute-q7", "image-preprocessing-permute", "hard", "In the address metaphor, what is a wrong column?", ["A tensor axis with the wrong meaning", "A missing YouTube video", "A bad class label only", "A shorter audio file"], 0, "A column maps to an axis role.", "Cannot map metaphor"),
      q("permute-q8", "image-preprocessing-permute", "hard", "Does permute usually change pixel values?", ["No, it changes arrangement/axis order", "Yes, it subtracts means", "Yes, it divides by 255", "Yes, it changes labels"], 0, "Permute reorders data, it does not normalize values.", "Collapses permute with normalization"),
      q("permute-q9", "image-preprocessing-permute", "medium", "Which layout has channels first?", ["CHW", "HWC", "WHC only", "BHW"], 0, "CHW starts with channels.", "Layout recognition miss"),
      q("permute-q10", "image-preprocessing-permute", "hard", "Why is permute a contract step?", ["The model code expects each axis in a specific position", "The user prefers a pretty chart", "The image file must be smaller", "The model needs a YouTube id"], 0, "The model expects a specific dimension order.", "Cannot state contract"),
    ],
  },
  {
    title: "Part 5: Batch fixes the model call",
    part_id: "batch",
    concept: "image-preprocessing-batch",
    intro:
      "Batch adds the example dimension so the model call receives one or more images in the format it expects.",
    metaphor:
      "It is like putting one worksheet into a folder. Even if there is only one worksheet, the system expects a folder of worksheets.",
    why:
      "Most model forward calls expect a batch dimension: [batch, channels, height, width]. A single preprocessed image [channels, height, width] is one example but not yet a batch.",
    example:
      "After resize/rescale/normalize/permute, a single image may be [3, 224, 224]. Adding batch makes it [1, 3, 224, 224], meaning one image in the batch.",
    skip:
      "If batch is skipped, the model may interpret the channel axis as the batch axis, reject the input rank, or produce confusing shape errors.",
    summary:
      "Batch fixes the outer wrapper for the model call. It says how many examples are being sent.",
    audio:
      "This visualization is about the outer wrapper. By the time we reach batching, the image has the right canvas, units, baseline, and axis order. But a model forward call usually still expects a collection of examples. Use the batch-size control and watch the shape become batch, channels, height, width. A single image becomes one item in a batch: one, three, two hundred twenty-four, two hundred twenty-four. The folder metaphor is the key. The worksheet may be complete, but the receiving process expects a folder. If you hand it a loose sheet, it may treat the first row as the folder or reject the handoff. In tensor terms, skipping batch means the rank is wrong. The visual proves that batch does not change the image content. It wraps the image so the model call knows how many examples it is processing.",
    questions: [
      q("batch-q1", "image-preprocessing-batch", "easy", "What does the batch dimension represent?", ["How many examples are being sent", "The red channel mean", "The image width only", "The class name"], 0, "The batch dimension counts examples.", "Confuses batch with image dimensions"),
      q("batch-q2", "image-preprocessing-batch", "easy", "What shape does one CHW image often become after adding batch?", ["[1, C, H, W]", "[C, H, W, 1]", "[H, W]", "[labels, C]"], 0, "A single example becomes batch size 1.", "Cannot add batch dimension"),
      q("batch-q3", "image-preprocessing-batch", "medium", "Why add a batch dimension for a single image?", ["The model forward call expects a batch of examples", "The image needs another color channel", "The file needs a new extension", "The mean must be removed twice"], 0, "Even one image is usually passed as a batch of size 1.", "Does not understand single-example batching"),
      q("batch-q4", "image-preprocessing-batch", "medium", "What is the common PyTorch image batch layout?", ["[B, C, H, W]", "[H, W, C, B]", "[C, B, H, W]", "[W, B, label]"], 0, "PyTorch image batches commonly use batch, channels, height, width.", "Layout confusion"),
      q("batch-q5", "image-preprocessing-batch", "medium", "In the folder metaphor, what is the folder?", ["The batch dimension", "The red channel", "The standard deviation", "The answer key"], 0, "The folder is the outer batch wrapper.", "Cannot map metaphor"),
      q("batch-q6", "image-preprocessing-batch", "hard", "What can break if batch is skipped?", ["The model may receive a rank-3 tensor when it expects rank-4", "The image becomes grayscale automatically", "The labels are normalized", "The YouTube clip stops"], 0, "Many model calls expect rank 4: B,C,H,W.", "Misses tensor rank"),
      q("batch-q7", "image-preprocessing-batch", "hard", "Does adding batch change image pixel content?", ["No, it wraps the image as an example", "Yes, it rescales pixels", "Yes, it changes RGB to BGR", "Yes, it creates labels"], 0, "Batching adds an outer dimension; the image content stays the same.", "Confuses wrapping with transformation"),
      q("batch-q8", "image-preprocessing-batch", "easy", "A shape [3, 224, 224] means what before batching?", ["One CHW image", "One batch of three images", "A text token list", "A final prediction"], 0, "It is a single channel-first image.", "Misreads shape"),
      q("batch-q9", "image-preprocessing-batch", "medium", "A shape [8, 3, 224, 224] means what?", ["8 images, 3 channels each, 224 by 224", "3 images, 8 channels each", "224 labels", "No batch dimension"], 0, "The first axis is batch size.", "Misreads BCHW"),
      q("batch-q10", "image-preprocessing-batch", "hard", "Why is batch the last wrapper in this lesson's pipeline?", ["The image's shape, units, baseline, and axes should be fixed before stacking/sending examples", "Batching computes the ImageNet mean", "Batching performs resizing", "Batching chooses the correct class"], 0, "Batching wraps already-prepared examples for the model call.", "Cannot place step in pipeline"),
    ],
  },
];

function buildReading(part: PartSpec) {
  return {
    intro: part.intro,
    blocks: [
      { type: "heading", text: "Why this step exists" },
      { type: "paragraph", text: part.why },
      { type: "example", title: "Easy metaphor", body: part.metaphor },
      { type: "example", title: "Concrete example", body: part.example },
      { type: "callout", tone: "warning", text: `If skipped: ${part.skip}` },
    ],
    summary: part.summary,
  };
}

function buildPartContent(part: PartSpec, interactive: unknown) {
  return {
    part_id: part.part_id,
    reading: buildReading(part),
    audio: {
      script: part.audio,
      duration_hint: 90,
    },
    interactive,
    quiz: {
      pass_threshold: 4,
      consecutive_correct_required: 4,
      idk_option: true,
      questions: part.questions,
    },
  };
}

function main() {
  const db = getDb();
  const lessonId = 4;
  const tx = db.transaction(() => {
    for (const part of PARTS) {
      const row = db
        .prepare(
          `SELECT id, content FROM lesson_activities
           WHERE lesson_id = ? AND title LIKE ?
           ORDER BY sequence_order ASC LIMIT 1`
        )
        .get(lessonId, `%${part.part_id === "resize" ? "Resize" : part.part_id === "rescale" ? "Rescale" : part.part_id === "normalize" ? "Normalize" : part.part_id === "permute" ? "Permute" : "Batch"}%`) as
        | { id: number; content: string }
        | undefined;
      if (!row) throw new Error(`Missing activity for ${part.part_id}`);
      const interactive = JSON.parse(row.content);
      const content = JSON.stringify(buildPartContent(part, interactive));
      db.prepare(
        `UPDATE lesson_activities
         SET activity_type = 'lesson_part', title = ?, content = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(part.title, content, row.id);
      db.prepare(
        `DELETE FROM generated_artifacts
         WHERE lesson_id = ? AND activity_id = ? AND artifact_type = 'audio'`
      ).run(lessonId, row.id);
    }
  });
  tx();
  console.log(`Backfilled lesson ${lessonId} with ${PARTS.length} lesson parts`);
  closeDb();
}

main();
