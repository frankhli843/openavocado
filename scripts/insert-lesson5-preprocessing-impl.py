#!/usr/bin/env python3
"""
Insert lesson 2 for subject 4 (GDM Image Preprocessor):
  "Code It From Scratch: PIL, NumPy, and the Preprocessing Pipeline"

Pedagogical gap being addressed:
  - Learner understands the 5 pipeline steps conceptually but explicitly
    skipped coding practice in lesson 1.
  - axis-order-hwc-chw flagged as weak (IDK on medium question).
  - pixel-dtype had 1 IDK on easy question.
  - Subject criteria: "Code-first approach using Python/PIL/NumPy. Implement
    each preprocessing step from scratch before using library abstractions."
"""

import json
import sqlite3
import sys
from datetime import datetime, timezone

DB_PATH = "/home/frank/.openclaw/workspace/code/avocadocore/data/avocadocore.db"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def q_mc(id_, concept, difficulty, question, choices, correct_index, explanation,
         misconception_target, learning_scope="taught", support_ref=None):
    return {
        "id": id_,
        "concept": concept,
        "difficulty": difficulty,
        "learning_scope": learning_scope,
        "support_ref": support_ref or f"Part reading: {concept}",
        "question": question,
        "choices": choices,
        "correct_index": correct_index,
        "explanation": explanation,
        "misconception_target": misconception_target,
        "rephrase_instructions": (
            "Rephrase with a different Python example or analogous situation. "
            "Preserve the same concept and do not reveal the answer in the question."
        ),
    }


def make_quiz(questions, grounding_required=True):
    return {
        "grounding_required": grounding_required,
        "pass_threshold": 4,
        "consecutive_correct_required": 4,
        "idk_option": True,
        "questions": questions,
    }


# ---------------------------------------------------------------------------
# Knowledge graph
# ---------------------------------------------------------------------------

KNOWLEDGE_GRAPH = {
    "type": "focused",
    "title": "PIL + NumPy Implementation — Hands-On Pipeline Build",
    "description": (
        "This lesson teaches the concrete Python implementation of every "
        "preprocessing step. Concepts in green are fully implemented. "
        "Amber nodes are previewed for the next lesson."
    ),
    "nodes": [
        {
            "id": "pipeline-root",
            "label": "Preprocessing Pipeline",
            "category": "subject_root",
            "covered": True,
            "description": "End-to-end from image file to float NCHW tensor",
        },
        {
            "id": "pil-open-convert",
            "label": "PIL Open + Convert",
            "category": "concept",
            "covered": True,
            "description": "Image.open(path).convert('RGB') — standardises mode and channels",
        },
        {
            "id": "pil-resize",
            "label": "PIL Resize",
            "category": "concept",
            "covered": True,
            "description": "img.resize((H, W), Image.LANCZOS) — high-quality spatial contract",
        },
        {
            "id": "np-asarray",
            "label": "np.asarray + dtype",
            "category": "concept",
            "covered": True,
            "description": "uint8 HWC array — the exact shape and type NumPy delivers",
        },
        {
            "id": "pixel-dtype",
            "label": "pixel-dtype (uint8 → float32)",
            "category": "concept",
            "covered": True,
            "description": "arr.astype(np.float32) / 255.0 — converts units safely",
        },
        {
            "id": "normalize-impl",
            "label": "Normalize (broadcast)",
            "category": "concept",
            "covered": True,
            "description": "(arr - mean) / std with shape-3 broadcast over HWC",
        },
        {
            "id": "axis-order-hwc-chw",
            "label": "HWC → CHW (transpose)",
            "category": "concept",
            "covered": True,
            "description": "np.transpose(arr, (2, 0, 1)) — moves channel axis to front",
        },
        {
            "id": "batch-dim-impl",
            "label": "Batch dim (expand)",
            "category": "concept",
            "covered": True,
            "description": "np.expand_dims(arr, 0) — adds N=1 for NCHW",
        },
        {
            "id": "patch-tokenization",
            "label": "Patch Tokenization",
            "category": "preview",
            "covered": False,
            "preview": True,
            "description": "How Gemma 4 slices the NCHW tensor into patch tokens — next lesson",
        },
        {
            "id": "gemma4-contract",
            "label": "Gemma 4 Contract",
            "category": "preview",
            "covered": False,
            "preview": True,
            "description": "Exact input spec for the Gemma 4 vision encoder — upcoming",
        },
        {
            "id": "data-aug",
            "label": "Data Augmentation",
            "category": "concept",
            "covered": False,
            "description": "Random flips, jitter, crops — explored in a later lesson",
        },
    ],
    "edges": [
        {"from": "pipeline-root", "to": "pil-open-convert"},
        {"from": "pil-open-convert", "to": "pil-resize"},
        {"from": "pil-resize", "to": "np-asarray"},
        {"from": "np-asarray", "to": "pixel-dtype"},
        {"from": "pixel-dtype", "to": "normalize-impl"},
        {"from": "normalize-impl", "to": "axis-order-hwc-chw"},
        {"from": "axis-order-hwc-chw", "to": "batch-dim-impl"},
        {"from": "batch-dim-impl", "to": "patch-tokenization"},
        {"from": "pipeline-root", "to": "data-aug"},
        {"from": "batch-dim-impl", "to": "gemma4-contract"},
    ],
}


# ---------------------------------------------------------------------------
# Main audio orientation visual (declarative)
# ---------------------------------------------------------------------------

ORIENTATION_VISUAL = {
    "schema_version": "1.0",
    "widget_type": "declarative",
    "title": "Pipeline Code Skeleton — Shape & Dtype at Each Step",
    "instructions": (
        "Use the 'Current Step' control to step through the preprocessing pipeline. "
        "At each step, observe what the Python call looks like, what the array shape "
        "becomes, and what the dtype is. Pay attention to where uint8 changes to float32 "
        "and where HWC changes to CHW."
    ),
    "controls": [
        {
            "type": "segmented",
            "id": "step",
            "label": "Current Step",
            "options": [
                {"label": "1. Open", "value": 0},
                {"label": "2. Resize", "value": 1},
                {"label": "3. np.asarray", "value": 2},
                {"label": "4. /255 float", "value": 3},
                {"label": "5. Normalize", "value": 4},
                {"label": "6. Transpose", "value": 5},
                {"label": "7. Expand", "value": 6},
            ],
            "default": 0,
        }
    ],
    "outputs": [
        {
            "id": "shape_h",
            "label": "Height",
            "formula": "step < 1 ? 1080 : 896",
            "format": "integer",
        },
        {
            "id": "shape_w",
            "label": "Width",
            "formula": "step < 1 ? 1920 : 896",
            "format": "integer",
        },
        {
            "id": "shape_c",
            "label": "Channels/C",
            "formula": "3",
            "format": "integer",
        },
        {
            "id": "mem_mb",
            "label": "Memory (MB)",
            "formula": "step < 3 ? (shape_h * shape_w * 3 / 1048576) : (shape_h * shape_w * 3 * 4 / 1048576)",
            "format": "number",
            "precision": 2,
        },
    ],
    "panels": [
        {
            "title": "Python call",
            "template": (
                "{{step == 0 ? 'img = Image.open(path).convert(\"RGB\")  # PIL Image, mode=RGB' : "
                "step == 1 ? 'img = img.resize((896, 896), Image.LANCZOS)  # still PIL, still uint8' : "
                "step == 2 ? 'arr = np.asarray(img)  # shape=(896, 896, 3)  dtype=uint8  HWC' : "
                "step == 3 ? 'arr = arr.astype(np.float32) / 255.0  # shape=(896,896,3)  dtype=float32  range=[0,1]' : "
                "step == 4 ? 'arr = (arr - mean) / std  # shape=(896,896,3)  normalized  HWC' : "
                "step == 5 ? 'arr = np.transpose(arr, (2, 0, 1))  # shape=(3, 896, 896)  CHW!' : "
                "'arr = np.expand_dims(arr, 0)  # shape=(1, 3, 896, 896)  NCHW batch'}}"
            ),
        },
        {
            "title": "Array shape & dtype",
            "template": (
                "Shape: {{step < 5 ? '(' + shape_h + ', ' + shape_w + ', 3)  [HWC]' : "
                "step == 5 ? '(3, 896, 896)  [CHW]' : '(1, 3, 896, 896)  [NCHW]'}}  |  "
                "dtype: {{step < 3 ? 'uint8  (0..255)' : 'float32  (' + (step < 4 ? '0.0..1.0' : 'centered around 0') + ')'}}"
            ),
        },
        {
            "title": "Memory footprint",
            "template": "{{mem_mb}} MB ({{step < 3 ? 'uint8=1 byte/value' : 'float32=4 bytes/value'}})",
        },
        {
            "title": "What changes at this step",
            "template": (
                "{{step == 0 ? 'Guarantees 3-channel RGB mode regardless of source format (RGBA, L, P...).' : "
                "step == 1 ? 'Sets exact spatial dimensions. Model expects fixed H×W canvas. Uses LANCZOS anti-aliasing.' : "
                "step == 2 ? 'Converts PIL Image to NumPy array. dtype=uint8, values 0-255, layout HWC (rows first).' : "
                "step == 3 ? 'CRITICAL: converts uint8 → float32 FIRST, then divides by 255. Skipping astype() causes silent uint8 wraparound on subtraction.' : "
                "step == 4 ? 'Subtracts per-channel ImageNet mean, divides by std. Broadcasting aligns axis-2 (channels) automatically.' : "
                "step == 5 ? 'AXIS PERMUTE: moves channel axis from position 2 to position 0. (H,W,C) → (C,H,W). PyTorch/JAX expect CHW.' : "
                "'Adds batch dimension at axis 0. Single image N=1. Model call requires 4D input (N,C,H,W).'}}"
            ),
        },
    ],
}


# ---------------------------------------------------------------------------
# Part 1: Opening, Inspecting, and Resizing in PIL
# ---------------------------------------------------------------------------

PART1_QUIZ = make_quiz([
    q_mc("p1-q1", "pixel-dtype", "easy",
         "What dtype does np.asarray(img) return for a typical PIL image?",
         ["float32", "uint8", "int16", "bool"],
         1,
         "PIL images are 8-bit by default, so np.asarray gives uint8.",
         "Confuses PIL with a float conversion step",
         support_ref="Part 1 reading: np.asarray delivers uint8"),
    q_mc("p1-q2", "pixel-dtype", "easy",
         "What is the value range of pixel data in a uint8 NumPy array?",
         ["0.0 to 1.0", "0 to 255", "-1.0 to 1.0", "0 to 65535"],
         1,
         "uint8 is an 8-bit unsigned integer: 0 through 255.",
         "Confuses uint8 range with float normalized range",
         support_ref="Part 1 reading: uint8 range definition"),
    q_mc("p1-q3", "image-preprocessing-resize", "easy",
         "Why do we call .convert('RGB') immediately after Image.open()?",
         ["To flip the image vertically", "To guarantee 3-channel mode regardless of source format",
          "To convert uint8 to float", "To add the batch dimension"],
         1,
         ".convert('RGB') normalizes any source mode (RGBA, L, grayscale) to three-channel RGB.",
         "Confuses mode conversion with numeric conversion",
         support_ref="Part 1 reading: .convert('RGB') guarantees three-channel mode"),
    q_mc("p1-q4", "image-preprocessing-resize", "medium",
         "After img.resize((896, 896), Image.LANCZOS), what does img.size return?",
         ["(896, 896)", "(3, 896, 896)", "(896, 896, 3)", "(1, 896, 896)"],
         0,
         "PIL's .size returns (width, height) as a tuple — both 896 here.",
         "Confuses PIL .size tuple order with NumPy shape order",
         support_ref="Part 1 reading: PIL .size is (width, height)"),
    q_mc("p1-q5", "pixel-dtype", "medium",
         "What is the shape of arr after arr = np.asarray(img) for a 896×896 RGB image?",
         ["(3, 896, 896)", "(896, 896, 3)", "(1, 896, 896, 3)", "(896, 3, 896)"],
         1,
         "np.asarray returns HWC order: (height, width, channels) = (896, 896, 3).",
         "Confuses NumPy HWC with PyTorch CHW layout",
         support_ref="Part 1 reading: np.asarray delivers HWC shape"),
    q_mc("p1-q6", "image-preprocessing-resize", "medium",
         "Why do we resize in PIL before converting to NumPy?",
         ["PIL resize only works on uint8", "PIL's LANCZOS filter is higher quality and cheaper before array conversion",
          "NumPy cannot represent images", "PIL automatically normalizes values during resize"],
         1,
         "LANCZOS anti-aliasing in PIL is optimized for downsampling uint8 image data; converting to a large float array first wastes memory and compute.",
         "Does not understand the PIL-first resize rationale",
         support_ref="Part 1 reading: resize in PIL before NumPy conversion"),
    q_mc("p1-q7", "pixel-dtype", "hard",
         "What happens if you do arr - 160 on a uint8 array where arr[0,0,0] = 130?",
         ["The result is -30 stored as -30", "The result wraps to 226 due to uint8 unsigned overflow",
          "NumPy raises a TypeError", "The value becomes 0 by clamping"],
         1,
         "uint8 is unsigned; subtraction that would go negative wraps around: 130-160 = 226 in uint8 arithmetic.",
         "Does not know uint8 wraps instead of going negative",
         support_ref="Part 1 reading: uint8 wraparound on subtraction"),
    q_mc("p1-q8", "pixel-dtype", "hard",
         "A colleague passes arr (dtype=uint8, range 0-255) directly to the normalize step without calling /255 first. What is the main risk?",
         ["The model refuses uint8 tensors with a clear error", "Silent uint8 wraparound produces garbage values without any error or warning",
          "NumPy refuses to subtract from uint8", "Normalization only runs on float64"],
         1,
         "NumPy will silently wrap subtraction results in uint8, producing wrong values with no error.",
         "Assumes NumPy catches the dtype mismatch loudly",
         support_ref="Part 1 reading: why astype(float32) must come before normalize"),
    q_mc("p1-q9", "image-preprocessing-resize", "easy",
         "PIL's .size attribute returns (width, height). NumPy's .shape for the same image returns what?",
         ["(width, height, channels)", "(height, width, channels)", "(channels, height, width)", "(batch, channels, height, width)"],
         1,
         "NumPy arrays store rows (height) first: shape = (H, W, C).",
         "Swaps PIL .size and NumPy .shape conventions",
         support_ref="Part 1 reading: PIL .size vs NumPy .shape axis order"),
    q_mc("p1-q10", "pixel-dtype", "medium",
         "Which of these correctly converts a uint8 NumPy array to float32 in [0.0, 1.0]?",
         ["arr.astype(np.float64)", "arr.astype(np.float32) / 255.0",
          "arr / 255", "arr.astype(np.float32)"],
         1,
         "You must both astype(float32) AND divide by 255; dividing without astype gives float64 by default (may be correct but is not idiomatic); astype alone without dividing gives values in [0..255] as floats.",
         "Forgets to divide or to convert dtype",
         support_ref="Part 1 reading: two-step uint8→float32 conversion"),
])

PART1 = {
    "part_id": "pil-open-resize",
    "reading": {
        "intro": "Before any NumPy arithmetic, the image must be opened, standardised, and resized in PIL. This part covers the three PIL calls that set up the pipeline correctly.",
        "blocks": [
            {"type": "heading", "text": "Step 1: Open and convert to RGB"},
            {"type": "paragraph", "text": (
                "PIL can load JPEG, PNG, WebP, GIF, TIFF, and many other formats. "
                "But different image files store pixel data in different modes: RGB (3 channels), "
                "RGBA (4 channels including alpha), L (grayscale), P (palette). "
                "A model preprocessing pipeline must receive exactly 3 channels every time. "
                "`Image.open(path).convert('RGB')` guarantees this regardless of the source format."
            )},
            {"type": "example", "title": "Opening code", "body": (
                "from PIL import Image\n"
                "import numpy as np\n\n"
                "img = Image.open('cat.jpg').convert('RGB')\n"
                "print(img.mode)    # 'RGB'\n"
                "print(img.size)    # (width, height) e.g. (1920, 1080)"
            )},
            {"type": "callout", "tone": "warning", "text": (
                "PIL's `.size` returns (width, height) — width first. "
                "NumPy's `.shape` returns (height, width, channels) — height first. "
                "These are reversed. Remember: PIL=WH, NumPy=HWC."
            )},
            {"type": "heading", "text": "Step 2: Resize in PIL"},
            {"type": "paragraph", "text": (
                "Models expect a fixed spatial canvas. Gemma 4's vision encoder uses 896×896 pixels; "
                "many ImageNet models use 224×224. We resize in PIL — before converting to NumPy — "
                "because PIL's LANCZOS filter does high-quality anti-aliased downsampling on uint8 data. "
                "It is more memory-efficient and produces fewer artifacts than resizing a large float array."
            )},
            {"type": "example", "title": "Resize code", "body": (
                "TARGET = 896  # Gemma 4 vision input size\n"
                "img = img.resize((TARGET, TARGET), Image.LANCZOS)\n"
                "print(img.size)   # (896, 896) — PIL reports (W, H)"
            )},
            {"type": "heading", "text": "Step 3: Convert to NumPy — dtype and shape"},
            {"type": "paragraph", "text": (
                "`np.asarray(img)` converts the PIL Image to a NumPy array. "
                "The dtype is `uint8` — unsigned 8-bit integers in the range [0, 255]. "
                "The shape is `(H, W, 3)` — height × width × channels. "
                "This is called HWC order: Height is axis 0, Width is axis 1, Channels are axis 2."
            )},
            {"type": "definition", "term": "uint8",
             "definition": "An unsigned 8-bit integer. Range: 0 to 255. NumPy default for image arrays loaded from disk. CANNOT hold negative numbers — subtraction that goes negative wraps around silently."},
            {"type": "callout", "tone": "warning", "text": (
                "CRITICAL: Do NOT normalize or subtract anything from uint8 arrays. "
                "130 − 160 in uint8 wraps to 226, not −30. "
                "Always convert to float32 BEFORE any arithmetic."
            )},
            {"type": "example", "title": "np.asarray code", "body": (
                "arr = np.asarray(img)\n"
                "print(arr.dtype)   # uint8\n"
                "print(arr.shape)   # (896, 896, 3)  — HWC\n"
                "print(arr.min(), arr.max())   # 0, 255"
            )},
            {"type": "summary", "text": (
                "Three PIL calls set up the pipeline: open converts the file, "
                ".convert('RGB') standardises to 3 channels, .resize sets the spatial canvas, "
                "and np.asarray delivers a uint8 HWC array. "
                "No arithmetic happens yet — PIL keeps everything in the safe uint8 world."
            ) if False else None},
        ],
        "summary": (
            "PIL handles the file, the channel count, and the spatial size. "
            "np.asarray hands off a uint8 HWC array to NumPy. "
            "No arithmetic until after the dtype is float32."
        ),
        "diagrams": [
            {
                "kind": "mermaid",
                "title": "PIL to NumPy handoff",
                "mermaid": (
                    "flowchart LR\n"
                    "  A[\"Image.open(path)\\ndisk bytes\"] --> B[\".convert('RGB')\\n3-channel PIL\"]\n"
                    "  B --> C[\"img.resize(896,896)\\nPIL, still uint8\"]\n"
                    "  C --> D[\"np.asarray(img)\\nshape=(896,896,3)\\ndtype=uint8  HWC\"]"
                ),
                "takeaway": "Three PIL steps produce the uint8 HWC NumPy array that the arithmetic steps will transform.",
                "support_ref": "Part 1 reading: Steps 1, 2, 3 — PIL workflow",
            }
        ],
    },
    "audio": {
        "script": (
            "This part is about the first three lines of code: open, resize, and convert to NumPy. "
            "Let's be concrete. You call Image.open with a file path. PIL is lazy — it reads the file header "
            "immediately but does not decode the full pixel data yet. You immediately chain .convert('RGB') "
            "because images on disk come in many modes. A PNG might be RGBA with a transparency channel. "
            "A scan might be grayscale L. A GIF might be palette mode P. .convert('RGB') forces exactly "
            "three channels regardless, so the rest of the pipeline never has to ask 'how many channels does this image have?'"
            "\n\n"
            "The interactive for this part shows a pixel inspector. You can toggle the dtype between uint8 and float32 "
            "and see how the same pixel value looks different depending on the unit. "
            "When you look at the uint8 column, notice the values are integers between 0 and 255. "
            "When you look at the float32 column after dividing by 255, they are decimals between 0 and 1. "
            "The same information, different units — like describing a 100-centimetre table as a 1-metre table."
            "\n\n"
            "Now resize. img.resize takes a tuple. PIL's tuple is (width, height) — width first. "
            "For Gemma 4, that is (896, 896). The resampling filter is Image.LANCZOS, which uses "
            "a high-quality anti-aliasing algorithm to avoid the blocky artefacts you get with nearest-neighbour. "
            "We do this in PIL, not NumPy, because operating on uint8 bytes is cheaper than operating on float arrays. "
            "Only after resize do we call np.asarray to hand the data off to NumPy."
            "\n\n"
            "np.asarray returns a uint8 array with shape (H, W, 3). Notice the axis order: "
            "height first, then width, then channels. This is called HWC — height, width, channels. "
            "It is how NumPy naturally stores image data because rows (height) are the outermost "
            "repeating structure, then columns (width), then the three channel values per pixel. "
            "This is important: NumPy says HWC, but the model we will eventually call says CHW. "
            "We will fix that later. For now, just remember: out of np.asarray, you have uint8 HWC."
            "\n\n"
            "The one trap on this step: PIL's img.size reports (width, height), but NumPy's arr.shape "
            "reports (height, width, 3). The order flips. If you are checking sizes, use "
            "arr.shape[0] for height, arr.shape[1] for width — not arr.shape[1], arr.shape[0]. "
            "This is one of those small gotchas that causes bugs in production code."
        ),
    },
    "interactive": {
        "schema_version": "1.0",
        "widget_type": "declarative",
        "title": "Pixel dtype Inspector: uint8 vs float32",
        "instructions": (
            "Adjust the 'Pixel value (uint8)' slider to set a raw pixel channel value. "
            "See what happens to that value after /255 (rescale) and after normalizing "
            "with the red channel ImageNet mean and std. "
            "Notice how subtracting 123 from a uint8 value would wrap around — "
            "the /255 step must happen BEFORE normalization."
        ),
        "controls": [
            {
                "type": "slider",
                "id": "raw_val",
                "label": "Pixel value (uint8)",
                "min": 0,
                "max": 255,
                "step": 1,
                "default": 130,
            },
            {
                "type": "toggle",
                "id": "show_wraparound",
                "label": "Show uint8 wraparound (the bug)",
                "default": False,
                "onLabel": "Show wraparound danger",
                "offLabel": "Normal path",
            },
        ],
        "outputs": [
            {
                "id": "float_val",
                "label": "After /255 (float32)",
                "formula": "raw_val / 255",
                "format": "number",
                "precision": 4,
            },
            {
                "id": "normalized_val",
                "label": "After normalize (red ch, mean=0.485 std=0.229)",
                "formula": "(raw_val / 255 - 0.485) / 0.229",
                "format": "number",
                "precision": 4,
            },
            {
                "id": "wraparound_result",
                "label": "uint8 subtract 123 WITHOUT /255 (bug!)",
                "formula": "show_wraparound ? ((raw_val - 123 + 256) % 256) : raw_val",
                "format": "integer",
            },
        ],
        "panels": [
            {
                "title": "What these numbers mean",
                "template": (
                    "raw uint8={{raw_val}} (range 0-255) → "
                    "float32={{float_val}} (range 0.0-1.0) → "
                    "normalized={{normalized_val}} (centered near 0)\n\n"
                    "{{show_wraparound ? 'BUG PATH: Subtracting 123 from uint8 ' + raw_val + ' without /255 first gives ' + wraparound_result + ' — completely wrong!' : "
                    "'Safe path: /255 first, then normalize. Never subtract from uint8.'}}"
                ),
            }
        ],
        "charts": [
            {
                "type": "bar",
                "title": "Value at each step",
                "bars": [
                    {"label": "uint8 (÷255 to compare)", "ref": "float_val", "color": "#94a3b8"},
                    {"label": "After /255", "ref": "float_val", "color": "#3b82f6"},
                    {"label": "After normalize", "ref": "normalized_val", "color": "#22c55e"},
                ],
            }
        ],
    },
    "quiz": PART1_QUIZ,
}


# ---------------------------------------------------------------------------
# Part 2: Rescale to Float + Normalize with Broadcasting
# ---------------------------------------------------------------------------

PART2_QUIZ = make_quiz([
    q_mc("p2-q1", "pixel-dtype", "easy",
         "Which line correctly converts a uint8 array to float32 in the range [0.0, 1.0]?",
         ["arr.astype(np.float32)", "arr / 255.0", "arr.astype(np.float32) / 255.0", "arr.astype(np.float64) / 255"],
         2,
         "You need both astype(float32) to avoid float64 and /255.0 to get the [0,1] range.",
         "Forgets to do both steps together",
         support_ref="Part 2 reading: two-step rescale"),
    q_mc("p2-q2", "image-preprocessing-normalize", "easy",
         "What shape does the ImageNet mean array have?",
         ["(3,)", "(1, 3)", "(3, 1, 1)", "(896, 896, 3)"],
         0,
         "The mean is one value per channel: shape (3,). NumPy broadcasts it over H and W.",
         "Does not know the mean is per-channel not per-pixel",
         support_ref="Part 2 reading: ImageNet mean shape (3,)"),
    q_mc("p2-q3", "image-preprocessing-normalize", "easy",
         "The ImageNet red channel mean is approximately 0.485. After normalization, what value does a pixel with red=0.485 become?",
         ["0.485", "0.0", "1.0", "-0.485"],
         1,
         "(0.485 - 0.485) / 0.229 = 0.0. The mean subtracts to zero.",
         "Does not understand that mean normalization centers values at 0",
         support_ref="Part 2 reading: normalize centers the distribution at 0"),
    q_mc("p2-q4", "normalised-range", "medium",
         "After normalization with ImageNet stats, what is the approximate range of pixel values?",
         ["[0, 1]", "[-3, 3] approximately", "[0, 255]", "[0.0, 0.5]"],
         1,
         "After subtracting mean and dividing by std, values are roughly in [-2.5, 2.5] for most natural images.",
         "Assumes normalization keeps values in [0,1]",
         support_ref="Part 2 reading: value range after normalization"),
    q_mc("p2-q5", "image-preprocessing-normalize", "medium",
         "arr has shape (896, 896, 3) and mean has shape (3,). How does NumPy apply (arr - mean)?",
         ["It broadcasts mean over the H and W axes, applying each channel's mean to the matching channel",
          "It raises a shape mismatch error",
          "It applies the mean to axis 0 only",
          "It adds zeros for H and W axes"],
         0,
         "NumPy aligns the trailing axis (axis 2, channels) and broadcasts the (3,) mean across all H×W positions.",
         "Does not understand NumPy trailing-axis broadcasting",
         support_ref="Part 2 reading: broadcasting (3,) over (H,W,3)"),
    q_mc("p2-q6", "pixel-dtype", "medium",
         "Why must arr.astype(np.float32) come BEFORE arr - mean?",
         ["Because mean is float and you cannot subtract float from int",
          "Because uint8 cannot hold negative values so the subtraction wraps around silently",
          "Because PIL images must be float before normalizing",
          "Because float32 is required by the ImageNet standard"],
         1,
         "The danger is silent uint8 unsigned wraparound. A uint8 value of 100 minus the equivalent of mean~123 wraps to a high positive number.",
         "Does not know about uint8 silent wraparound",
         support_ref="Part 2 reading: astype must come before subtract"),
    q_mc("p2-q7", "imagenet-stats", "easy",
         "ImageNet normalization constants are used because:",
         ["They make every pixel exactly 0.5", "They match the statistical distribution models were trained on",
          "They prevent float overflow", "They are required by all Python packages"],
         1,
         "The constants encode the mean and std of the ImageNet training set. Using them centers inputs the same way the model expects.",
         "Thinks normalization is about preventing overflow",
         support_ref="Part 2 reading: why ImageNet stats exist"),
    q_mc("p2-q8", "image-preprocessing-normalize", "hard",
         "You apply normalization directly without rescaling first: arr = (arr.astype(np.float32) - np.array([123.675, 116.28, 103.53])) / np.array([58.395, 57.12, 57.375]). What range are these constants in?",
         ["0–1 range (they are fractions)", "0–255 range (they are uint8-scale stats)", "-1–1 range", "Undefined"],
         1,
         "These are the 0-255-scale equivalents of the ImageNet stats. Some frameworks use /255-first (0-1 range), others subtract raw uint8 statistics. Both are correct with matching stats.",
         "Does not know ImageNet stats have two common scaling conventions",
         support_ref="Part 2 reading: two normalization conventions"),
    q_mc("p2-q9", "rescaling", "easy",
         "What does dividing all pixel values by 255 accomplish?",
         ["It removes the color information", "It changes the dtype to float64",
          "It maps the range [0, 255] to [0.0, 1.0]", "It subtracts the mean"],
         2,
         "Division by 255 is a linear rescaling: min 0 maps to 0.0, max 255 maps to 1.0.",
         "Confuses rescaling with normalization",
         support_ref="Part 2 reading: /255 maps to [0,1]"),
    q_mc("p2-q10", "image-preprocessing-normalize", "hard",
         "Why does arr - mean work without a loop when arr.shape = (H, W, 3) and mean.shape = (3,)?",
         ["NumPy automatically pads mean with ones on the left to shape (1, 1, 3) and broadcasts",
          "NumPy repeats mean H×W times before subtracting",
          "NumPy requires equal shapes; this would error",
          "NumPy only broadcasts when arrays have the same number of dimensions"],
         0,
         "NumPy broadcasting rules align shapes from the right: (H,W,3) and (3,) align on axis 2, then broadcast over H and W.",
         "Does not understand NumPy shape broadcasting rules",
         support_ref="Part 2 reading: broadcasting trailing-axis alignment"),
])

PART2 = {
    "part_id": "rescale-normalize",
    "reading": {
        "intro": "Two steps convert the uint8 HWC array into a float32 array with values centered near zero. Order matters: rescale before normalize.",
        "blocks": [
            {"type": "heading", "text": "Step 4: Rescale to float32"},
            {"type": "paragraph", "text": (
                "The single most important guard is converting dtype before any arithmetic. "
                "`arr.astype(np.float32) / 255.0` does two things in one line: "
                "`astype(np.float32)` changes every element from an 8-bit integer to a 32-bit float, "
                "then `/ 255.0` maps the range [0, 255] to [0.0, 1.0]. "
                "Think of it as switching from 'out of 255' to 'out of 1' — proportionally the same information, different unit."
            )},
            {"type": "callout", "tone": "warning", "text": (
                "Do NOT write `arr / 255.0` without `astype` first. Python will infer float64 "
                "(double-precision), which uses twice the memory and may mismatch framework expectations. "
                "Always write `arr.astype(np.float32) / 255.0`."
            )},
            {"type": "heading", "text": "Step 5: Normalize with ImageNet statistics"},
            {"type": "paragraph", "text": (
                "Most vision models are trained with their input images normalized so the pixel "
                "distribution has approximately zero mean and unit standard deviation per channel. "
                "The standard ImageNet constants are:\n\n"
                "  mean = [0.485, 0.456, 0.406]  (R, G, B channels)\n"
                "  std  = [0.229, 0.224, 0.225]  (R, G, B channels)\n\n"
                "These were computed from 1.2 million ImageNet training images. "
                "Normalizing with them shifts inputs to match what the model's first layer "
                "was optimized to receive."
            )},
            {"type": "definition", "term": "NumPy broadcasting",
             "definition": "When arrays have different shapes, NumPy aligns dimensions from the right (trailing axis) and automatically repeats smaller arrays across the larger axes. For (H, W, 3) minus (3,): the (3,) aligns on axis 2 and broadcasts over all H×W positions."},
            {"type": "example", "title": "Normalize code", "body": (
                "mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)\n"
                "std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)\n"
                "arr = (arr - mean) / std   # shape (H, W, 3) — broadcasts correctly\n"
                "# After this: values are roughly in [-2.5, 2.5]\n"
                "# A pure-mean red pixel: (0.485 - 0.485) / 0.229 = 0.0"
            )},
            {"type": "callout", "tone": "insight", "text": (
                "Two normalization conventions exist. This lesson uses the /255-first convention "
                "where mean/std are in [0,1]. Some frameworks use raw uint8-scale stats "
                "(mean≈[123.7, 116.3, 103.5], std≈[58.4, 57.1, 57.4]) and subtract from unscaled floats. "
                "Both are mathematically equivalent when the matching stats are used. "
                "If a model is trained with raw-scale stats, using the /255 stats gives wrong inputs."
            )},
            {"type": "summary", "text": (
                "Rescale converts uint8 [0,255] to float32 [0.0,1.0]. "
                "Normalize centers each channel around 0 using ImageNet mean/std. "
                "Broadcasting handles the (3,) vs (H,W,3) shape mismatch automatically. "
                "Order matters: always astype before arithmetic."
            )},
        ],
        "diagrams": [
            {
                "kind": "mermaid",
                "title": "Rescale + Normalize flow",
                "mermaid": (
                    "flowchart LR\n"
                    "  A[\"arr\\nuint8 HWC\\n[0..255]\"] --> B[\"astype(float32) / 255\\nfloat32 HWC\\n[0.0..1.0]\"]\n"
                    "  B --> C[\"subtract mean (3,)\\nbroadcast over H×W\"]\n"
                    "  C --> D[\"divide by std (3,)\\nfloat32 HWC\\n~[-2.5..2.5]\"]"
                ),
                "takeaway": "Two steps: dtype conversion + range rescaling, then statistical centering per channel.",
                "support_ref": "Part 2 reading: Steps 4 and 5 — rescale and normalize",
            }
        ],
    },
    "audio": {
        "script": (
            "Now we are in NumPy land and we need to do two things before we touch the axis order: "
            "rescale the values to float32 in [0,1], then normalize each channel with the ImageNet statistics."
            "\n\n"
            "The rescale step is one expression: arr.astype(np.float32) / 255.0. "
            "Two things happen simultaneously. astype(np.float32) changes every uint8 element to a 32-bit float — "
            "now the array can hold fractions and negative numbers. Then / 255.0 maps the old [0,255] range to [0.0,1.0]. "
            "A pixel that was 255 becomes 1.0. A pixel that was 0 becomes 0.0. A pixel that was 127 becomes about 0.498. "
            "The important thing: this must happen before any subtraction. If you subtract from uint8, "
            "values that would go negative wrap around silently — a common bug that produces corrupted input tensors "
            "with no error message."
            "\n\n"
            "The interactive for this part lets you pick a single pixel channel value and trace it through both steps. "
            "Move the slider and watch how the float32 value changes, then how the normalized value lands. "
            "Notice the normalized value is close to zero for inputs near the channel mean. "
            "That centering is the entire point of normalization."
            "\n\n"
            "The normalize step uses three per-channel constants: the ImageNet mean and standard deviation. "
            "mean = [0.485, 0.456, 0.406] and std = [0.229, 0.224, 0.225]. "
            "These were computed from 1.2 million ImageNet training images. "
            "The expression is (arr - mean) / std. "
            "arr has shape (H, W, 3) and mean has shape (3,). "
            "NumPy broadcasting aligns the trailing axis — the channels axis — and applies each channel's "
            "constant to that channel's slice across all H×W positions. "
            "No loop needed. NumPy handles it automatically."
            "\n\n"
            "After normalization, values are roughly in [-2.5, 2.5] for most natural images. "
            "A pixel with red channel value equal to the mean — 0.485 — becomes exactly 0.0. "
            "A pixel at 0.0 (solid black) becomes (0 - 0.485) / 0.229 = -2.12. "
            "The model's first layer was trained to receive this distribution, so sending unnormalized "
            "inputs causes the learned features to fire incorrectly."
        ),
    },
    "interactive": {
        "schema_version": "1.0",
        "widget_type": "image-preprocessing-pipeline",
        "title": "Preprocessing Pipeline Simulator",
        "instructions": (
            "Use the pipeline widget to see how pixel values change through each step. "
            "Focus on the 'Rescale' and 'Normalize' stages. "
            "Toggle each step off to see what breaks when it is skipped."
        ),
        "params": {},
    },
    "quiz": PART2_QUIZ,
}


# ---------------------------------------------------------------------------
# Part 3: Permute HWC→CHW and Add Batch Dimension
# ---------------------------------------------------------------------------

PART3_QUIZ = make_quiz([
    q_mc("p3-q1", "axis-order-hwc-chw", "easy",
         "What is the shape of arr after np.transpose(arr, (2, 0, 1)) if arr.shape = (896, 896, 3)?",
         ["(3, 896, 896)", "(896, 3, 896)", "(896, 896, 3)", "(1, 896, 896)"],
         0,
         "np.transpose(arr, (2, 0, 1)) moves axis 2 to position 0, axis 0 to position 1, axis 1 to position 2: (896,896,3) → (3,896,896).",
         "Does not know what np.transpose axis tuple means",
         support_ref="Part 3 reading: np.transpose axis permutation"),
    q_mc("p3-q2", "axis-order-hwc-chw", "easy",
         "What axis order does PyTorch/JAX expect for a single image tensor?",
         ["HWC (height, width, channels)", "CHW (channels, height, width)",
          "WHC (width, height, channels)", "NHW (batch, height, width)"],
         1,
         "PyTorch and JAX use CHW: channels first, then height, then width.",
         "Confuses HWC (NumPy default) with CHW (PyTorch/JAX)",
         support_ref="Part 3 reading: CHW is the PyTorch/JAX convention"),
    q_mc("p3-q3", "image-preprocessing-batch", "easy",
         "np.expand_dims(arr, axis=0) changes shape from (3, 896, 896) to what?",
         ["(3, 1, 896, 896)", "(1, 3, 896, 896)", "(3, 896, 896, 1)", "(3, 896, 0, 896)"],
         1,
         "expand_dims at axis=0 inserts a new dimension at position 0: (3,896,896) → (1,3,896,896).",
         "Places the new axis in the wrong position",
         support_ref="Part 3 reading: np.expand_dims at axis 0"),
    q_mc("p3-q4", "axis-order-hwc-chw", "medium",
         "np.transpose(arr, (2, 0, 1)) — what does the tuple (2, 0, 1) specify?",
         ["The axis sizes to use", "The order of dimensions in the output: output[0]=old axis 2, output[1]=old axis 0, output[2]=old axis 1",
          "A slice selection for each axis", "The number of channels"],
         1,
         "The tuple specifies which OLD axis maps to each position in the result: output position 0 gets old axis 2, etc.",
         "Misreads the transpose argument as sizes or slices",
         support_ref="Part 3 reading: what the (2,0,1) tuple means"),
    q_mc("p3-q5", "axis-order-hwc-chw", "medium",
         "A model's first conv layer expects input of shape (batch, channels, height, width). A developer forgets the transpose and passes shape (1, 896, 896, 3). What is most likely to happen?",
         ["Silent wrong output because the model reads height as channels and channels as width",
          "A clear shape error because the model validates channel count",
          "The model automatically reorders dimensions",
          "Nothing changes because shapes are equivalent"],
         0,
         "If the model expects (1,3,896,896) and receives (1,896,896,3), it reads 896 as C and 3 as W. If 3 happens to match a dummy dimension, it may silently compute garbage.",
         "Assumes the model will catch the axis error automatically",
         support_ref="Part 3 reading: what breaks if you forget transpose"),
    q_mc("p3-q6", "image-preprocessing-batch", "medium",
         "Why does a model need a batch dimension even for a single image?",
         ["Batches compress the image", "The model's layers are designed for N×C×H×W inputs and always expect the N axis",
          "The batch dimension stores pixel dtype info", "A single image has no batch dimension by definition"],
         1,
         "The model's weight tensors and operations are shaped for batches. A 3D input causes a shape mismatch on the first matrix multiply.",
         "Thinks a single image can skip the batch axis",
         support_ref="Part 3 reading: model requires NCHW even for N=1"),
    q_mc("p3-q7", "axis-order-hwc-chw", "hard",
         "You have a tensor of shape (3, 896, 896) and want to verify it is CHW. Which check is correct?",
         ["assert arr.shape[2] == 3", "assert arr.shape[0] == 3",
          "assert arr.shape[1] == arr.shape[2]", "assert arr.ndim == 4"],
         1,
         "In CHW, the channel axis is at position 0. For RGB, shape[0] == 3 confirms C=3 channels at the front.",
         "Places the channel check on the wrong axis",
         support_ref="Part 3 reading: CHW means channels at axis 0"),
    q_mc("p3-q8", "image-preprocessing-batch", "hard",
         "arr[np.newaxis, ...] and np.expand_dims(arr, axis=0) produce shapes that are:",
         ["Different — newaxis inserts at the end", "Identical — both produce (1, C, H, W)",
          "Different — newaxis adds two dimensions", "Identical only if arr is 2D"],
         1,
         "Both np.newaxis at position 0 in an index and expand_dims(arr, 0) insert a size-1 axis at position 0.",
         "Thinks newaxis and expand_dims work differently for N=1",
         support_ref="Part 3 reading: np.newaxis vs np.expand_dims equivalence"),
    q_mc("p3-q9", "axis-order-hwc-chw", "medium",
         "After np.transpose(arr, (2, 0, 1)), which axis holds the Red channel data?",
         ["Axis 2", "Axis 0", "Axis 1", "All axes share channel data"],
         1,
         "After CHW permutation, axis 0 is channels. For RGB, axis-0 slice 0 is Red, slice 1 is Green, slice 2 is Blue.",
         "Does not know which axis holds channels after transpose",
         support_ref="Part 3 reading: CHW axis 0 is channels"),
    q_mc("p3-q10", "axis-order-hwc-chw", "hard",
         "Gemma 4 expects an image input of shape (1, 3, 896, 896). If you pass (896, 896, 3) instead, describe the exact shape mismatch.",
         ["N=896 is wrong (expected 1), C=896 is wrong (expected 3), H=3 is wrong (expected 896)",
          "No mismatch — 3 channels appear somewhere in both shapes",
          "The model reads the HWC shape correctly because it auto-detects axis order",
          "Only the batch dimension is wrong"],
         0,
         "The model reads axis 0 as batch=896 (wrong), axis 1 as channels=896 (wrong), axis 2 as height=3 (wrong). Every single dimension is wrong.",
         "Assumes partial shape match is sufficient or model auto-detects axis order",
         support_ref="Part 3 reading: exact NCHW requirement of Gemma 4"),
])

PART3 = {
    "part_id": "permute-batch",
    "reading": {
        "intro": "The final two steps before the model call: move the channel axis from position 2 to position 0, then add the batch dimension.",
        "blocks": [
            {"type": "heading", "text": "Step 6: Permute HWC → CHW"},
            {"type": "paragraph", "text": (
                "After rescaling and normalizing, arr still has shape (H, W, 3) — HWC order. "
                "PyTorch and JAX (and the Gemma 4 vision encoder) expect CHW: channels at axis 0, "
                "then height, then width. "
                "`np.transpose(arr, (2, 0, 1))` reorders the axes: "
                "the tuple (2, 0, 1) means 'put old axis 2 first, then old axis 0, then old axis 1'. "
                "Result: (H, W, 3) → (3, H, W)."
            )},
            {"type": "definition", "term": "np.transpose(arr, axes)",
             "definition": "Returns a view of arr with axes permuted. The `axes` tuple maps each output position to the input axis that goes there. (2, 0, 1) means: output axis 0 = input axis 2 (channels), output axis 1 = input axis 0 (height), output axis 2 = input axis 1 (width)."},
            {"type": "example", "title": "Concrete transpose example", "body": (
                "# Before: arr.shape = (896, 896, 3)  HWC\n"
                "# arr[row, col, channel_idx] selects a channel value\n\n"
                "arr = np.transpose(arr, (2, 0, 1))\n"
                "# After: arr.shape = (3, 896, 896)   CHW\n"
                "# arr[channel_idx, row, col] — channels are now outermost\n\n"
                "# Verify:\n"
                "assert arr.shape == (3, 896, 896)\n"
                "assert arr.shape[0] == 3  # channels at axis 0"
            )},
            {"type": "callout", "tone": "warning", "text": (
                "What breaks if you skip this: The model's first convolution layer reads axis 0 as "
                "channels and axis 2 as width. If you pass HWC (H=896, W=896, C=3), the model thinks "
                "it has 896 channels, 896 height slices, and 3 width pixels. "
                "If the model architecture happens to accept that shape (because some dimension is coincidentally 3), "
                "it silently produces garbage without raising a shape error. "
                "This is one of the hardest bugs to catch."
            )},
            {"type": "heading", "text": "Step 7: Add the batch dimension"},
            {"type": "paragraph", "text": (
                "The model expects NCHW: batch size N, channels C, height H, width W. "
                "For a single image, N=1. `np.expand_dims(arr, axis=0)` inserts a new axis "
                "at position 0, giving shape (1, 3, H, W). "
                "The alternative syntax `arr[np.newaxis, ...]` is exactly equivalent."
            )},
            {"type": "example", "title": "Add batch dimension", "body": (
                "arr = np.expand_dims(arr, axis=0)\n"
                "# OR equivalently:\n"
                "# arr = arr[np.newaxis, ...]\n\n"
                "print(arr.shape)   # (1, 3, 896, 896)  — NCHW!\n"
                "assert arr.dtype == np.float32\n"
                "assert arr.ndim == 4"
            )},
            {"type": "summary", "text": (
                "Two axis operations complete the pipeline: np.transpose (2,0,1) moves channels to front, "
                "np.expand_dims at axis 0 adds the batch dimension. "
                "Final shape: (1, 3, 896, 896) in float32. "
                "This is exactly what Gemma 4's vision encoder input contract requires."
            )},
        ],
        "diagrams": [
            {
                "kind": "mermaid",
                "title": "HWC → CHW → NCHW axis transformation",
                "mermaid": (
                    "flowchart LR\n"
                    "  A[\"float32 HWC\\n(896, 896, 3)\\naxis: H W C\"] -->|\"np.transpose\\n(2, 0, 1)\"| B[\"float32 CHW\\n(3, 896, 896)\\naxis: C H W\"]\n"
                    "  B -->|\"np.expand_dims\\naxis=0\"| C[\"float32 NCHW\\n(1, 3, 896, 896)\\naxis: N C H W\"]"
                ),
                "takeaway": "Two operations fix the axis order: transpose moves channels to front, expand_dims adds the batch axis N=1.",
                "support_ref": "Part 3 reading: Steps 6 and 7 — permute and batch",
            }
        ],
    },
    "audio": {
        "script": (
            "This part is about the two operations that complete the pipeline: np.transpose and np.expand_dims. "
            "These are the steps that transform a NumPy HWC array into the exact shape a model expects."
            "\n\n"
            "After rescaling and normalizing, arr has shape (896, 896, 3). "
            "Axis 0 is height — the rows. Axis 1 is width — the columns. Axis 2 is channels — R, G, B. "
            "This is HWC order. It is the natural order for NumPy because a 2D image is stored as rows of pixels, "
            "each pixel having three channel values. "
            "But PyTorch, JAX, and the Gemma 4 vision encoder all use CHW: channels first. "
            "This convention comes from how convolutional filters are implemented — having all channel slices "
            "contiguous in memory is more cache-friendly for the convolution kernel."
            "\n\n"
            "np.transpose does the reordering. The call is np.transpose(arr, (2, 0, 1)). "
            "The tuple (2, 0, 1) tells NumPy: make the new axis 0 from old axis 2, "
            "the new axis 1 from old axis 0, the new axis 2 from old axis 1. "
            "Result: (H=896, W=896, C=3) becomes (C=3, H=896, W=896). "
            "The interactive for this part shows a tiny 2×2 RGB array so you can see "
            "exactly where each value moves during the transpose. "
            "Toggle between HWC and CHW and trace a single red-channel value through the permutation."
            "\n\n"
            "The failure mode if you skip this: the model sees 896 as the channel count. "
            "Its first convolution layer has filters sized for 3 input channels, not 896. "
            "This usually raises a shape mismatch error immediately. "
            "But if by coincidence the H or W dimension is 3 — for example, a 3×3 thumbnail — "
            "the model may silently accept it and compute completely wrong outputs. "
            "No error, no warning, just garbage predictions. The silent failure is why this step matters."
            "\n\n"
            "After transpose, arr has shape (3, 896, 896). One more step: add the batch axis. "
            "The model call signature is (N, C, H, W) — batch first. "
            "np.expand_dims(arr, axis=0) inserts a size-1 axis at position 0. "
            "Shape becomes (1, 3, 896, 896). "
            "The alternative is arr[np.newaxis, ...] — identical result. "
            "This final array is exactly what Gemma 4's vision encoder expects. "
            "In the next lesson we will see what happens after this point: the encoder slices "
            "this tensor into 14×14 pixel patches, projects them into embedding vectors, "
            "and concatenates them with the text token embeddings. "
            "But that is a preview — for now, your job is to produce (1, 3, 896, 896) float32."
        ),
    },
    "interactive": {
        "schema_version": "1.0",
        "widget_type": "declarative",
        "title": "HWC → CHW Axis Permutation — Trace a Single Value",
        "instructions": (
            "This widget shows a miniature 2×2 RGB image tensor. "
            "Use the controls to pick a row, column, and channel. "
            "See where that value lives in HWC layout and where it moves to in CHW layout. "
            "Flip the 'Add batch dimension' toggle to see the final NCHW shape."
        ),
        "controls": [
            {
                "type": "slider", "id": "row", "label": "Row (height axis)",
                "min": 0, "max": 1, "step": 1, "default": 0,
            },
            {
                "type": "slider", "id": "col", "label": "Col (width axis)",
                "min": 0, "max": 1, "step": 1, "default": 0,
            },
            {
                "type": "segmented", "id": "ch", "label": "Channel",
                "options": [{"label": "R (ch 0)", "value": 0}, {"label": "G (ch 1)", "value": 1}, {"label": "B (ch 2)", "value": 2}],
                "default": 0,
            },
            {
                "type": "toggle", "id": "add_batch", "label": "Add batch dimension",
                "default": False, "onLabel": "NCHW (final)", "offLabel": "CHW only",
            },
        ],
        "outputs": [
            {
                "id": "hwc_idx0", "label": "HWC: axis 0 index (= row)",
                "formula": "row", "format": "integer",
            },
            {
                "id": "hwc_idx1", "label": "HWC: axis 1 index (= col)",
                "formula": "col", "format": "integer",
            },
            {
                "id": "hwc_idx2", "label": "HWC: axis 2 index (= channel)",
                "formula": "ch", "format": "integer",
            },
            {
                "id": "chw_idx0", "label": "CHW: axis 0 index (= channel)",
                "formula": "ch", "format": "integer",
            },
            {
                "id": "chw_idx1", "label": "CHW: axis 1 index (= row)",
                "formula": "row", "format": "integer",
            },
            {
                "id": "chw_idx2", "label": "CHW: axis 2 index (= col)",
                "formula": "col", "format": "integer",
            },
        ],
        "panels": [
            {
                "title": "Before transpose — HWC",
                "template": (
                    "arr[{{hwc_idx0}}, {{hwc_idx1}}, {{hwc_idx2}}]  ← HWC index [row, col, channel]\n"
                    "Shape: (2, 2, 3)   Axes: [Height=2, Width=2, Channels=3]"
                ),
            },
            {
                "title": "After np.transpose(arr, (2, 0, 1)) — CHW",
                "template": (
                    "arr[{{chw_idx0}}, {{chw_idx1}}, {{chw_idx2}}]  ← CHW index [channel, row, col]\n"
                    "SAME VALUE, different address! Shape: (3, 2, 2)   Axes: [Channels=3, Height=2, Width=2]\n\n"
                    "{{add_batch ? 'After np.expand_dims(arr, 0): shape = (1, 3, 2, 2)  NCHW — model-ready!' : "
                    "'Next: np.expand_dims(arr, 0) will add batch=1 to get (1, 3, 2, 2)'}}"
                ),
            },
            {
                "title": "What the transpose does",
                "template": (
                    "np.transpose(arr, (2, 0, 1)) means:\n"
                    "  new axis 0 ← old axis 2 (channels, C={{ch}})\n"
                    "  new axis 1 ← old axis 0 (height, H={{row}})\n"
                    "  new axis 2 ← old axis 1 (width, W={{col}})\n\n"
                    "The VALUE does not change — only the ADDRESS where NumPy stores it."
                ),
            },
        ],
    },
    "quiz": PART3_QUIZ,
}


# ---------------------------------------------------------------------------
# Practice code
# ---------------------------------------------------------------------------

PRACTICE_CODE = {
    "language": "python",
    "title": "Implement the Full Preprocessing Pipeline",
    "description": (
        "Complete the `preprocess_image` function by filling in the five TODO steps. "
        "Each step corresponds to one line from the lesson. "
        "The function should take a path to any image file and return a float32 NCHW "
        "NumPy array of shape (1, 3, target_size, target_size)."
    ),
    "starter_code": (
        "from PIL import Image\n"
        "import numpy as np\n\n\n"
        "def preprocess_image(\n"
        "    image_path: str,\n"
        "    target_size: int = 896,\n"
        ") -> np.ndarray:\n"
        "    \"\"\"\n"
        "    Preprocess a single image for a Gemma-style vision model.\n\n"
        "    Args:\n"
        "        image_path: Path to the image file (JPEG, PNG, WebP, etc.)\n"
        "        target_size: Target spatial size in pixels (default: 896 for Gemma 4)\n\n"
        "    Returns:\n"
        "        float32 NumPy array of shape (1, 3, target_size, target_size)\n"
        "        — NCHW batch format, values normalized to ~[-2.5, 2.5]\n"
        "    \"\"\"\n"
        "    # Step 1: Open image and convert to RGB\n"
        "    # PIL can open JPEG, PNG, WebP, TIFF, etc.\n"
        "    # .convert('RGB') guarantees exactly 3 channels regardless of source mode.\n"
        "    # API: Image.open(path)  .convert('RGB')\n"
        "    img = Image.open(image_path).convert('RGB')\n\n"
        "    # Step 2: Resize to target_size x target_size\n"
        "    # Use Image.LANCZOS for high-quality anti-aliased downsampling.\n"
        "    # PIL .resize() takes a (width, height) tuple.\n"
        "    # API: img.resize((width, height), resample=Image.LANCZOS)\n"
        "    # TODO: resize img to (target_size, target_size) using Image.LANCZOS\n"
        "    \n\n"
        "    # Step 3: Convert PIL image to NumPy array\n"
        "    # Result dtype: uint8  shape: (target_size, target_size, 3)  HWC order\n"
        "    # API: np.asarray(img)\n"
        "    # TODO: convert img to a NumPy array named 'arr'\n"
        "    \n\n"
        "    # Step 4: Rescale to float32 in [0.0, 1.0]\n"
        "    # CRITICAL: do astype(float32) BEFORE any subtraction!\n"
        "    # uint8 arithmetic wraps around silently (130 - 160 = 226 in uint8, not -30).\n"
        "    # API: arr.astype(np.float32) / 255.0\n"
        "    # TODO: convert arr to float32 and divide by 255\n"
        "    \n\n"
        "    # Step 5: Normalize with ImageNet per-channel statistics\n"
        "    # mean and std have shape (3,) — NumPy broadcasts over H and W automatically.\n"
        "    # API: (arr - mean) / std\n"
        "    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)\n"
        "    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)\n"
        "    # TODO: subtract mean and divide by std\n"
        "    \n\n"
        "    # Step 6: Permute HWC → CHW\n"
        "    # np.transpose(arr, (2, 0, 1)) moves axis 2 (channels) to position 0.\n"
        "    # (H, W, 3) → (3, H, W)\n"
        "    # API: np.transpose(arr, axes)\n"
        "    # TODO: permute arr from HWC to CHW\n"
        "    \n\n"
        "    # Step 7: Add batch dimension\n"
        "    # (3, H, W) → (1, 3, H, W)  — NCHW format\n"
        "    # API: np.expand_dims(arr, axis=0)  OR  arr[np.newaxis, ...]\n"
        "    # TODO: add batch dimension at axis 0\n"
        "    \n\n"
        "    return arr\n"
    ),
    "constraints": [
        "Do not import any library except PIL.Image and numpy",
        "The function must return a np.float32 array",
        "The returned array must have shape (1, 3, target_size, target_size)",
        "Do not hard-code any pixel values or shapes",
    ],
    "guided_steps": [
        "Step 2: call img.resize((target_size, target_size), Image.LANCZOS)",
        "Step 3: arr = np.asarray(img) — check arr.dtype and arr.shape before continuing",
        "Step 4: arr = arr.astype(np.float32) / 255.0 — both operations together",
        "Step 5: arr = (arr - mean) / std — broadcasting handles (H,W,3) vs (3,) automatically",
        "Step 6: arr = np.transpose(arr, (2, 0, 1)) — verify shape is (3, H, W) after",
        "Step 7: arr = np.expand_dims(arr, axis=0) — final shape should be (1, 3, H, W)",
    ],
    "hints": [
        {
            "level": 1,
            "text": "Conceptual nudge: there are 5 TODOs. Each maps directly to one API call introduced in the lesson. Go through them in order — each step changes either the shape or the dtype or both.",
        },
        {
            "level": 2,
            "text": "Structural plan: Step 2 = img.resize(size_tuple, resample). Step 3 = np.asarray. Step 4 = astype + divide. Step 5 = subtract mean, divide std. Step 6 = np.transpose with a 3-element tuple. Step 7 = np.expand_dims with axis=0.",
        },
        {
            "level": 3,
            "text": "Package/API hint:\n- PIL: img.resize((target_size, target_size), Image.LANCZOS)\n- NumPy: np.asarray(img), arr.astype(np.float32), np.transpose(arr, axes), np.expand_dims(arr, axis)",
        },
        {
            "level": 4,
            "text": "Syntax hint:\n- Step 2: img = img.resize((target_size, target_size), Image.LANCZOS)\n- Step 3: arr = np.asarray(img)\n- Step 4: arr = arr.astype(np.float32) / 255.0\n- Step 5: arr = (arr - mean) / std\n- Step 6: arr = np.transpose(arr, (2, 0, 1))\n- Step 7: arr = np.expand_dims(arr, axis=0)",
        },
        {
            "level": 5,
            "text": (
                "Near-complete answer:\n"
                "    img = img.resize((target_size, target_size), Image.LANCZOS)  # Step 2\n"
                "    arr = np.asarray(img)                                         # Step 3\n"
                "    arr = arr.astype(np.float32) / 255.0                         # Step 4\n"
                "    arr = (arr - mean) / std                                     # Step 5\n"
                "    arr = np.transpose(arr, (2, 0, 1))                           # Step 6\n"
                "    arr = np.expand_dims(arr, axis=0)                            # Step 7"
            ),
        },
        {
            "level": 6,
            "text": (
                "Complete answer explanation:\n\n"
                "Step 2: img.resize((target_size, target_size), Image.LANCZOS)\n"
                "  PIL's .resize takes (width, height) — both are target_size here.\n"
                "  LANCZOS is a high-quality resampling filter that minimises aliasing.\n\n"
                "Step 3: arr = np.asarray(img)\n"
                "  Converts the PIL Image to a uint8 NumPy array, shape (target_size, target_size, 3).\n\n"
                "Step 4: arr = arr.astype(np.float32) / 255.0\n"
                "  astype converts uint8 to float32 FIRST — prevents silent wraparound.\n"
                "  Dividing by 255.0 maps [0,255] → [0.0,1.0].\n\n"
                "Step 5: arr = (arr - mean) / std\n"
                "  mean/std have shape (3,). NumPy broadcasts over H and W automatically.\n"
                "  Values shift to be centered near 0 (the model's expected input distribution).\n\n"
                "Step 6: arr = np.transpose(arr, (2, 0, 1))\n"
                "  Moves the channel axis from position 2 to position 0: (H,W,C) → (C,H,W).\n"
                "  The tuple (2,0,1) means: new_axis_0=old_axis_2, new_axis_1=old_axis_0, new_axis_2=old_axis_1.\n\n"
                "Step 7: arr = np.expand_dims(arr, axis=0)\n"
                "  Inserts a size-1 batch axis at position 0: (C,H,W) → (1,C,H,W) = NCHW."
            ),
        },
    ],
    "public_tests": [
        {
            "id": "test-shape",
            "description": "Returned array must have shape (1, 3, target_size, target_size)",
            "code": (
                "import numpy as np\n"
                "from PIL import Image\n"
                "import tempfile, os\n\n"
                "# Create a synthetic test image\n"
                "img = Image.fromarray(np.random.randint(0, 255, (200, 300, 3), dtype=np.uint8), 'RGB')\n"
                "with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:\n"
                "    img.save(f.name)\n"
                "    path = f.name\n"
                "try:\n"
                "    result = preprocess_image(path, target_size=224)\n"
                "    assert result.shape == (1, 3, 224, 224), f'Expected (1,3,224,224) got {result.shape}'\n"
                "    print('PASS: shape is', result.shape)\n"
                "finally:\n"
                "    os.unlink(path)\n"
            ),
            "expected_output": "PASS",
        },
        {
            "id": "test-dtype",
            "description": "Returned array must have dtype float32",
            "code": (
                "import numpy as np\n"
                "from PIL import Image\n"
                "import tempfile, os\n\n"
                "img = Image.fromarray(np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8), 'RGB')\n"
                "with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:\n"
                "    img.save(f.name)\n"
                "    path = f.name\n"
                "try:\n"
                "    result = preprocess_image(path, target_size=64)\n"
                "    assert result.dtype == np.float32, f'Expected float32 got {result.dtype}'\n"
                "    print('PASS: dtype is', result.dtype)\n"
                "finally:\n"
                "    os.unlink(path)\n"
            ),
            "expected_output": "PASS",
        },
        {
            "id": "test-value-range",
            "description": "Values must be roughly in normalized range (not [0,255] or [0,1] unnormalized)",
            "code": (
                "import numpy as np\n"
                "from PIL import Image\n"
                "import tempfile, os\n\n"
                "# Use a grey image (128, 128, 128) so we can predict values\n"
                "grey = np.full((100, 100, 3), 128, dtype=np.uint8)\n"
                "img = Image.fromarray(grey, 'RGB')\n"
                "with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:\n"
                "    img.save(f.name)\n"
                "    path = f.name\n"
                "try:\n"
                "    result = preprocess_image(path, target_size=64)\n"
                "    # 128/255 ~ 0.502; (0.502 - 0.485)/0.229 ~ 0.074 for red\n"
                "    # Values should NOT be in [0,255] or [0,1] — they should be near 0\n"
                "    mean_val = float(result.mean())\n"
                "    assert -1.0 < mean_val < 1.0, f'Mean {mean_val:.4f} — values not normalized (expected near 0)'\n"
                "    print(f'PASS: mean value is {mean_val:.4f} (near zero as expected)')\n"
                "finally:\n"
                "    os.unlink(path)\n"
            ),
            "expected_output": "PASS",
        },
    ],
    "hidden_tests_description": (
        "Hidden tests verify: (1) correct handling of RGBA source images (must convert to 3 channels), "
        "(2) correct handling of grayscale source, (3) correct batch dimension at axis 0 specifically, "
        "(4) channel axis at position 1 in result, "
        "(5) values are float32 not float64."
    ),
}


# ---------------------------------------------------------------------------
# Assessment (freeform + MC quiz)
# ---------------------------------------------------------------------------

ASSESSMENT_QUESTIONS = [
    {
        "id": "a-ordering",
        "text": "Place the seven preprocessing steps in the correct implementation order.",
        "type": "ordering",
        "items": [
            "arr = np.expand_dims(arr, axis=0)  — add batch dimension",
            "img = img.resize((target_size, target_size), Image.LANCZOS)  — resize in PIL",
            "arr = np.asarray(img)  — convert to uint8 HWC NumPy array",
            "arr = np.transpose(arr, (2, 0, 1))  — permute HWC → CHW",
            "img = Image.open(path).convert('RGB')  — open and standardise channels",
            "arr = arr.astype(np.float32) / 255.0  — rescale to [0,1]",
            "arr = (arr - mean) / std  — normalize with ImageNet stats",
        ],
        "actual_answer": (
            "Correct order: (1) Image.open + convert, (2) img.resize, (3) np.asarray, "
            "(4) astype(float32)/255, (5) (arr-mean)/std, (6) np.transpose(2,0,1), (7) np.expand_dims(0). "
            "Critical constraints: astype/255 MUST come before normalize; resize SHOULD come before np.asarray; "
            "transpose MUST come before expand_dims."
        ),
        "rubric": "All 7 steps in order: +7 (1pt each). Critical ordering violations (normalize before astype, expand_dims before transpose): -2 each.",
        "support_ref": "All Parts — the complete 7-step pipeline",
        "difficulty": "medium",
        "concept": "image-preprocessing-pipeline-order",
    },
    {
        "id": "a-fill-dtype",
        "text": "Fill in the blank: After `arr = np.asarray(img)`, the array dtype is ___ and shape format is ___.",
        "type": "fill_blank",
        "blanks": [
            {
                "id": "b-dtype",
                "label": "dtype",
                "accepted_answers": ["uint8", "numpy.uint8", "np.uint8"],
            },
            {
                "id": "b-shape",
                "label": "shape format",
                "accepted_answers": ["HWC", "H W C", "(H, W, C)", "height width channels"],
            },
        ],
        "rubric": "dtype must be uint8 (not float, not int). Shape must say HWC or equivalent — the order matters.",
        "actual_answer": "dtype=uint8, shape format=HWC",
        "support_ref": "Part 1 reading: Step 3 — np.asarray dtype and shape",
        "difficulty": "easy",
        "concept": "pixel-dtype",
    },
    {
        "id": "a-freeform-wraparound",
        "text": (
            "A developer writes this code:\n\n"
            "    arr = np.asarray(img)  # dtype = uint8\n"
            "    arr = (arr - mean_uint8) / std_uint8  # tries to normalize before rescaling\n\n"
            "mean_uint8 = np.array([123, 116, 104]). "
            "What is the output value for a pixel with red channel value 100?"
        ),
        "type": "free_text",
        "hint": "Remember that uint8 can only hold values 0-255 and wraps around on underflow.",
        "actual_answer": (
            "100 - 123 = -23 in signed arithmetic. But uint8 is unsigned. "
            "-23 wraps around to 256 - 23 = 233. Then 233 / 58 ≈ 4.0. "
            "The correct answer should be (100/255 - 0.485)/0.229 ≈ 0.07, not 4.0. "
            "The result is completely wrong with no error raised."
        ),
        "rubric": "Must identify: (1) uint8 subtracts to 233 not -23 (wraparound), (2) this produces a wrong positive value instead of a small positive/negative float. Full credit for both. Partial credit for one.",
        "support_ref": "Part 1 reading: uint8 wraparound; Part 2 reading: astype must come first",
        "difficulty": "hard",
        "concept": "pixel-dtype",
    },
    {
        "id": "a-freeform-transpose",
        "text": (
            "After normalization, arr.shape = (896, 896, 3). "
            "You call arr = np.transpose(arr, (2, 0, 1)). "
            "What is the new shape? What was axis 0 before, and what is it now?"
        ),
        "type": "free_text",
        "hint": "Track each axis in the tuple (2, 0, 1): position 0 in the output gets old axis 2.",
        "actual_answer": (
            "New shape: (3, 896, 896). "
            "Axis 0 before: height (H=896). Axis 0 after: channels (C=3). "
            "The tuple (2, 0, 1) means: new[0]=old[2], new[1]=old[0], new[2]=old[1]. "
            "So C moves from position 2 to position 0."
        ),
        "rubric": "Must state: new shape=(3,896,896), and that channels are now at axis 0. Partial credit if shape correct but axis explanation missing.",
        "support_ref": "Part 3 reading: np.transpose (2,0,1) and HWC→CHW",
        "difficulty": "medium",
        "concept": "axis-order-hwc-chw",
    },
    {
        "id": "a-freeform-pipeline-check",
        "text": (
            "Write a 2-line assertion that verifies a `result` array is ready for a Gemma 4 vision model. "
            "Assume target_size=896. The assertions should check shape and dtype."
        ),
        "type": "free_text",
        "hint": "The model expects NCHW float32: what should the shape be?",
        "actual_answer": (
            "assert result.shape == (1, 3, 896, 896), f'Wrong shape: {result.shape}'\n"
            "assert result.dtype == np.float32, f'Wrong dtype: {result.dtype}'"
        ),
        "accepted_answers": [
            "assert result.shape == (1, 3, 896, 896)",
            "(1, 3, 896, 896)",
        ],
        "rubric": "Shape assertion must check (1, 3, 896, 896). dtype assertion must check float32 or np.float32. Both needed for full credit.",
        "support_ref": "Part 3 reading: final NCHW shape requirement",
        "difficulty": "medium",
        "concept": "image-preprocessing-batch",
    },
]

ASSESSMENT_QUIZ = make_quiz([
    q_mc("aq-1", "pixel-dtype", "easy",
         "What dtype does np.asarray(img) return for a standard PIL image?",
         ["float32", "uint8", "int32", "float64"],
         1, "PIL images are 8-bit per channel: uint8.",
         "Assumes NumPy auto-converts to float",
         support_ref="Part 1 reading: np.asarray dtype is uint8"),
    q_mc("aq-2", "axis-order-hwc-chw", "easy",
         "What does 'HWC' stand for?",
         ["Height, Width, Channels", "Horizontal, Vertical, Color", "Horizontal, Width, Count", "Height, Width, Count"],
         0, "HWC: Height (axis 0), Width (axis 1), Channels (axis 2).",
         "Cannot expand the axis-order abbreviation",
         support_ref="Part 1 reading: HWC axis order definition"),
    q_mc("aq-3", "axis-order-hwc-chw", "medium",
         "After np.transpose(arr, (2, 0, 1)), arr.shape was (H, W, 3). What is the new shape?",
         ["(3, W, H)", "(3, H, W)", "(H, 3, W)", "(H, W, 3)"],
         1, "(2,0,1) maps: new[0]=old[2]=3, new[1]=old[0]=H, new[2]=old[1]=W → (3,H,W).",
         "Misorders H and W in the result",
         support_ref="Part 3 reading: np.transpose (2,0,1) result shape"),
    q_mc("aq-4", "pixel-dtype", "medium",
         "Why must you call astype(np.float32) BEFORE normalizing?",
         ["float32 is faster than uint8 for subtraction",
          "uint8 subtraction can silently wrap around to wrong positive values",
          "PIL images are always float32 internally",
          "The normalize function rejects uint8 arrays with an error"],
         1, "Silent uint8 wraparound: 100 - 123 = 233 in uint8, not -23. No error is raised.",
         "Thinks NumPy will catch the problem or that PIL uses floats",
         support_ref="Part 2 reading: uint8 wraparound danger"),
    q_mc("aq-5", "image-preprocessing-batch", "easy",
         "np.expand_dims(arr, axis=0) changes shape (3, H, W) to what?",
         ["(H, W, 3)", "(3, 1, H, W)", "(1, 3, H, W)", "(3, H, W, 1)"],
         2, "expand_dims at axis=0 inserts the new dimension at position 0: (3,H,W) → (1,3,H,W).",
         "Places the batch dimension in the wrong axis",
         support_ref="Part 3 reading: np.expand_dims at axis 0"),
    q_mc("aq-6", "image-preprocessing-normalize", "medium",
         "What is the shape of the ImageNet mean vector used in (arr - mean)?",
         ["(H, W, 3)", "(1, 3, 1, 1)", "(3,)", "(3, 1)"],
         2, "mean has shape (3,) — one value per channel. NumPy broadcasts it over H and W.",
         "Thinks mean must match the full array shape",
         support_ref="Part 2 reading: mean shape (3,) and broadcasting"),
    q_mc("aq-7", "rescaling", "easy",
         "Dividing all pixel values by 255 maps them from [0, 255] to what range?",
         ["[0, 1]", "[-1, 1]", "[0, 0.1]", "[0, 128]"],
         0, "255 / 255 = 1.0; 0 / 255 = 0.0; the range maps linearly to [0.0, 1.0].",
         "Confuses rescaling with centering/normalization",
         support_ref="Part 2 reading: /255 maps to [0.0, 1.0]"),
    q_mc("aq-8", "axis-order-hwc-chw", "hard",
         "A model expects input shape (1, 3, 896, 896). You pass (1, 896, 896, 3). What does the model read as the channel count?",
         ["3 (it auto-detects)", "896 (reads axis 1 as channels)", "1 (reads the batch axis)", "None of the above"],
         1, "The model reads axis 1 as channels. You passed H=896 in that position, so it thinks there are 896 channels.",
         "Thinks the model auto-detects axis order",
         support_ref="Part 3 reading: what breaks if transpose is skipped"),
    q_mc("aq-9", "image-preprocessing-normalize", "hard",
         "Two preprocessing conventions exist: /255-first (mean in [0,1]) and raw-scale (mean in [0,255]). A model trained with raw-scale stats receives /255-normalized inputs. What happens?",
         ["The model works correctly because pixel values are proportional",
          "The model's activations are wrong because the centering offset does not match",
          "Only the color channels are affected, not the spatial features",
          "NumPy raises a ValueError due to stats mismatch"],
         1, "The model was trained to receive values centered around ~0 using raw-scale stats; sending [0,1] values with wrong-scale stats gives incorrectly shifted inputs.",
         "Assumes proportional mapping is sufficient regardless of normalization convention",
         support_ref="Part 2 reading: two normalization conventions must match"),
    q_mc("aq-10", "image-preprocessing-batch", "medium",
         "Which two expressions produce the same final shape when applied to arr of shape (3, H, W)?",
         ["np.expand_dims(arr, axis=0)  and  arr[:, np.newaxis, ...]",
          "np.expand_dims(arr, axis=0)  and  arr[np.newaxis, ...]",
          "np.expand_dims(arr, axis=1)  and  arr[np.newaxis, ...]",
          "arr[np.newaxis, ...]  and  arr.reshape(3, 1, H, W)"],
         1, "Both np.expand_dims(arr, 0) and arr[np.newaxis, ...] insert a size-1 dimension at position 0: (3,H,W)→(1,3,H,W).",
         "Confuses np.newaxis position with expand_dims axis",
         support_ref="Part 3 reading: np.expand_dims vs np.newaxis equivalence"),
], grounding_required=True)


# ---------------------------------------------------------------------------
# Next lesson diagnostics
# ---------------------------------------------------------------------------

NEXT_LESSON_DIAGNOSTICS = [
    {
        "id": "diag-impl-confidence",
        "prompt": "Without looking at hints, could you now write the 7-step preprocessing pipeline from memory? Which step would you still need to look up?",
        "hint": "Be specific — naming the exact line or API that feels uncertain helps tune the next lesson.",
    },
    {
        "id": "diag-axis-clarity",
        "prompt": "After working through the HWC → CHW permutation, does the np.transpose(arr, (2, 0, 1)) call feel intuitive? What would make it clearer?",
        "hint": "If it still feels mechanical rather than understood, the next lesson can revisit it with more examples.",
    },
    {
        "id": "diag-next-topic",
        "prompt": "After this lesson, what feels like the most natural next step: (a) going deeper on the Gemma 4 patch tokenization that turns this tensor into image tokens, or (b) more preprocessing practice — different image sizes, batches of images, or data augmentation?",
        "hint": "(a) moves toward the full Gemma 4 multimodal contract; (b) builds implementation fluency. Neither is wrong.",
    },
    {
        "id": "diag-code-confidence",
        "prompt": "How was the practice code experience? Did you use hints? Which step required the most thought?",
        "hint": "Your candid answer helps calibrate the difficulty and scaffolding for the next coding exercise.",
    },
    {
        "id": "diag-lookahead-gemma4",
        "prompt": "Preview for the next lesson: Gemma 4 takes the (1, 3, 896, 896) tensor you just built and splits it into 64×64 non-overlapping patches, then projects each patch into a 1152-dim embedding vector. How many patches does a 896×896 image produce? (This is not graded — just your first guess.)",
        "hint": "If each patch is 14×14 pixels, how many 14×14 blocks fit in 896×896?",
    },
]


# ---------------------------------------------------------------------------
# Full lesson content
# ---------------------------------------------------------------------------

LESSON = {
    "title": "Code It From Scratch: PIL, NumPy, and the Preprocessing Pipeline",
    "description": (
        "The previous lesson explained what each preprocessing step does conceptually. "
        "This lesson closes the gap: you will implement every step in Python using PIL and NumPy, "
        "understand the exact API calls and their arguments, and produce a (1, 3, 896, 896) float32 "
        "tensor ready for the Gemma 4 vision encoder."
    ),
    "goals": [
        "Write the complete image preprocessing pipeline from scratch using PIL and NumPy — open, resize, asarray, rescale, normalize, transpose, expand",
        "Explain the uint8 wraparound danger and why astype(float32) must come before any subtraction",
        "Apply np.transpose(arr, (2, 0, 1)) and describe exactly which axis moves where",
        "Verify a preprocessed array meets the shape and dtype contract: (1, 3, H, W) float32",
    ],
    "tags": ["image-preprocessing", "numpy", "pil", "pixel-dtype", "axis-order-hwc-chw", "multimodal-ai"],
    "mastery_targets": [
        {"concept": "pixel-dtype", "target_confidence": 0.9},
        {"concept": "axis-order-hwc-chw", "target_confidence": 0.85},
        {"concept": "image-preprocessing-normalize", "target_confidence": 0.9},
        {"concept": "image-preprocessing-permute", "target_confidence": 0.9},
        {"concept": "image-preprocessing-batch", "target_confidence": 0.9},
        {"concept": "image-preprocessing-resize", "target_confidence": 0.95},
    ],
    "knowledge_graph_data": KNOWLEDGE_GRAPH,
    "next_lesson_diagnostics": NEXT_LESSON_DIAGNOSTICS,
    "metadata": {
        "generator": "doramon-lesson-generator/v2",
        "generator_version": "2.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_context_summary": (
            "Lesson 1 completed (sequence_number=1). Learner admitted skipping code practice. "
            "axis-order-hwc-chw flagged as weak (IDK on medium). pixel-dtype had 1 IDK. "
            "Conceptual understanding confirmed strong at easy+medium. "
            "This lesson targets the implementation gap with code-first PIL/NumPy walkthrough."
        ),
    },
    "activities": [
        # 1. Audio with orientation visual
        {
            "activity_type": "audio",
            "is_core": True,
            "sequence_order": 1,
            "title": "Audio: Seven Lines of Code — The Complete Pipeline",
            "content": {
                "script": (
                    "Welcome back. In the last lesson you traced the image preprocessing pipeline conceptually: "
                    "resize fixes the canvas, rescale fixes the units, normalize fixes the baseline, "
                    "permute fixes the axis labels, and batch fixes the model call shape. "
                    "You got the concepts right. But you also told me you skipped the coding practice. "
                    "So this lesson is entirely about the implementation. "
                    "By the end you will be able to write every step from memory."
                    "\n\n"
                    "The whole pipeline is seven lines of Python. Seven. That is it. "
                    "The orientation visual below shows a step-by-step code skeleton. "
                    "Use the 'Current Step' control to step through all seven lines. "
                    "At each step, notice what the Python call looks like, "
                    "what the array shape becomes, and what the dtype is. "
                    "Two transitions in particular are worth watching: "
                    "step 4 where uint8 changes to float32, and step 6 where HWC changes to CHW."
                    "\n\n"
                    "Here are the seven lines in order. "
                    "Line one: img = Image.open(path).convert('RGB'). "
                    "Line two: img = img.resize((896, 896), Image.LANCZOS). "
                    "Line three: arr = np.asarray(img). "
                    "Line four: arr = arr.astype(np.float32) / 255.0. "
                    "Line five: arr = (arr - mean) / std. "
                    "Line six: arr = np.transpose(arr, (2, 0, 1)). "
                    "Line seven: arr = np.expand_dims(arr, axis=0). "
                    "\n\n"
                    "Each of these lines maps directly to the concepts from the last lesson. "
                    "Lines one and two are the resize contract fix. "
                    "Lines three and four are the unit fix. "
                    "Line five is the baseline fix. "
                    "Line six is the axis label fix. "
                    "Line seven is the model call shape fix. "
                    "\n\n"
                    "This lesson has three parts. "
                    "Part one covers lines one through three: opening the image in PIL and converting to NumPy. "
                    "The key things to understand here are why we resize in PIL before converting, "
                    "what uint8 means, and how PIL's size tuple and NumPy's shape tuple have reversed axis order. "
                    "\n\n"
                    "Part two covers lines four and five: rescaling to float32 and normalizing. "
                    "The critical thing here is the order: astype before arithmetic. "
                    "uint8 subtraction wraps around silently — that is the bug. "
                    "\n\n"
                    "Part three covers lines six and seven: permuting HWC to CHW and adding the batch dimension. "
                    "The HWC to CHW permutation is the step that had a don't-know signal in the previous quiz, "
                    "so this part goes deeper with a concrete interactive that shows you exactly "
                    "where each value moves during the transpose. "
                    "\n\n"
                    "After the three parts, there is a practice code exercise "
                    "where you implement the complete function with five TODOs. "
                    "Progressive hints are available — use them if you get stuck, "
                    "but try each step from the lesson first. "
                    "The tests check shape, dtype, and value range at the end. "
                    "\n\n"
                    "At the end of the lesson, there are look-ahead questions about what comes after this pipeline. "
                    "Gemma 4 takes the (1, 3, 896, 896) tensor you produce here and slices it into patches — "
                    "that patch tokenization process is the next lesson. "
                    "For now, your job is to get confident implementing the seven lines from memory. "
                    "Let's start with Part one."
                ),
                "orientation_visual": ORIENTATION_VISUAL,
            },
        },

        # 2. Part 1: PIL open, convert, resize, np.asarray
        {
            "activity_type": "lesson_part",
            "is_core": True,
            "sequence_order": 2,
            "title": "Part 1: Opening, Inspecting, and Resizing in PIL",
            "content": PART1,
        },

        # 3. Part 2: Rescale + Normalize
        {
            "activity_type": "lesson_part",
            "is_core": True,
            "sequence_order": 3,
            "title": "Part 2: Rescale to Float + Normalize with Broadcasting",
            "content": PART2,
        },

        # 4. Part 3: Transpose + Batch
        {
            "activity_type": "lesson_part",
            "is_core": True,
            "sequence_order": 4,
            "title": "Part 3: Permute HWC → CHW and Add the Batch Dimension",
            "content": PART3,
        },

        # 5. Practice code
        {
            "activity_type": "practice_code",
            "is_core": True,
            "sequence_order": 5,
            "title": "Code: Implement preprocess_image from Scratch",
            "content": PRACTICE_CODE,
        },

        # 6. Assessment
        {
            "activity_type": "assessment",
            "is_core": True,
            "sequence_order": 6,
            "title": "Assessment: PIL/NumPy Preprocessing Implementation",
            "content": {
                "questions": ASSESSMENT_QUESTIONS,
                "quiz": ASSESSMENT_QUIZ,
            },
        },
    ],
}


# ---------------------------------------------------------------------------
# DB insertion
# ---------------------------------------------------------------------------

def insert_lesson():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # Insert lesson
    cur.execute(
        """
        INSERT INTO lessons (
            subject_id, title, description, status, sequence_number,
            goals, tags, next_lesson_diagnostics, knowledge_graph_data,
            generated_by, generator_version, source_context, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            4,  # subject_id for GDM Image Preprocessor
            LESSON["title"],
            LESSON["description"],
            "queued",
            2,
            json.dumps(LESSON["goals"]),
            json.dumps(LESSON["tags"]),
            json.dumps(LESSON["next_lesson_diagnostics"]),
            json.dumps(LESSON["knowledge_graph_data"]),
            LESSON["metadata"]["generator"],
            LESSON["metadata"]["generator_version"],
            json.dumps({"source_context_summary": LESSON["metadata"]["source_context_summary"]}),
            now,
            now,
        ),
    )
    lesson_id = cur.lastrowid
    print(f"Inserted lesson id={lesson_id}")

    # Insert activities
    activity_ids = []
    for activity in LESSON["activities"]:
        cur.execute(
            """
            INSERT INTO lesson_activities (
                lesson_id, activity_type, is_core, sequence_order, title, content, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                lesson_id,
                activity["activity_type"],
                1 if activity["is_core"] else 0,
                activity["sequence_order"],
                activity["title"],
                json.dumps(activity["content"]),
                now,
                now,
            ),
        )
        activity_id = cur.lastrowid
        activity_ids.append((activity["activity_type"], activity_id))
        print(f"  Inserted activity type={activity['activity_type']} id={activity_id}")

    # Insert mastery targets as progress_points signals
    for target in LESSON["mastery_targets"]:
        cur.execute(
            """
            INSERT INTO mastery_signals (
                learner_id, subject_id, lesson_id, signal_type, concept, detail, confidence, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,  # learner_id
                4,  # subject_id
                lesson_id,
                "ready_to_advance",
                target["concept"],
                f"Target confidence for this lesson: {target['target_confidence']}",
                target["target_confidence"],
                now,
            ),
        )

    # Insert or update subject workpad
    workpad_content = """# Subject 4: GDM Image Preprocessor — Workpad (Learner 1)

## History

### Lesson 1 (seq=1, lesson_id=4): "From Raw Image to Model-Ready Tensor"
**Status:** Completed 2026-06-27
**Key finding:** Learner conceptually understood all 5 pipeline steps at easy+medium difficulty.
Learner explicitly skipped the coding practice ("I didn't put much effort into writing the code itself, I just skipped it").
Strong on: resize, rescale, normalize, permute at conceptual level.
Weak spots: axis-order-hwc-chw (IDK on medium), pixel-dtype (1 IDK on easy).
Freeform assessment questions all left blank — no evidence of written understanding.
**Quiz:** Not passed (6/6 correct but IDK answers on batch and axis-order questions).
**What this means:** Priority for next lesson = implementation, not more conceptual coverage.

### Lesson 2 (seq=2, lesson_id=placeholder): "Code It From Scratch: PIL, NumPy, and the Preprocessing Pipeline"
**Status:** Queued (generated 2026-06-27)
**Addresses:** Implementation gap. Code-first walkthrough of all 7 steps using PIL and NumPy.
Deep dive on axis-order-hwc-chw and pixel-dtype (both flagged weak).
Practice code: complete preprocess_image function with 5 TODOs.
Assessment: ordering + fill_blank + freeform + MC quiz.
**Preview introduced:** Gemma 4 patch tokenization (14×14 patches, 1152-dim projections).

## Curriculum Direction

After Lesson 2, if the learner passes the implementation quiz and practice code:
- **Next lesson (Lesson 3):** Patch tokenization and the Gemma 4 vision encoder contract.
  Topics: how (1, 3, 896, 896) is split into patches, patch embedding projection,
  why Gemma 4 uses 896×896 (vs 224 for ImageNet models), the full input contract
  for the vision-language multimodal model.
- If the learner struggles with implementation in Lesson 2, add a third practice lesson
  (batch preprocessing, RGBA handling, grayscale) before moving to tokenization.

## Open Questions
- Does the learner know PIL at all, or is this their first PIL exposure? Lesson 2 assumes
  basic Python familiarity but no PIL background — it introduces every PIL call explicitly.
- After Lesson 3 (patch tokenization), how much Gemma 4 architecture context does the learner need?
  They may need a bridge lesson on the transformer architecture and what attention means
  before the multimodal input contract makes sense.
"""

    cur.execute(
        "SELECT id FROM subject_workpads WHERE subject_id=4 AND learner_id=1"
    )
    existing_workpad = cur.fetchone()
    if existing_workpad:
        cur.execute(
            "UPDATE subject_workpads SET content=?, last_updated_by=?, last_updated_for=?, updated_at=?, version=version+1 WHERE id=?",
            (workpad_content, "lesson-generator-v2", "lesson_completion", now, existing_workpad["id"]),
        )
        print(f"Updated subject workpad id={existing_workpad['id']}")
    else:
        cur.execute(
            "INSERT INTO subject_workpads (subject_id, learner_id, content, version, last_updated_by, last_updated_for, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (4, 1, workpad_content, 1, "lesson-generator-v2", "lesson_completion", now, now),
        )
        print("Inserted subject workpad")

    conn.commit()
    conn.close()

    print(f"\nLesson id={lesson_id} inserted successfully.")
    print(f"Activities: {activity_ids}")
    return lesson_id, activity_ids


if __name__ == "__main__":
    lesson_id, activity_ids = insert_lesson()
    print(f"\nLesson id: {lesson_id}")
    print("Activity ids:")
    for atype, aid in activity_ids:
        print(f"  {atype}: {aid}")
