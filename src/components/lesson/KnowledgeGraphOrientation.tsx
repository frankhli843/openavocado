"use client";

/**
 * KnowledgeGraphOrientation — lesson-top subject map
 *
 * Shows where the current lesson sits in the broader subject curriculum.
 *
 * - "high-level" lesson: full subject graph, coverage box drawn around lesson nodes.
 * - "focused" lesson: subgraph centred on the concepts this lesson dives into.
 *
 * When `graphData` is null but `subjectTags` / `lessonTags` are provided,
 * falls back to a tag-derived radial view so every lesson shows something.
 */

import type { KnowledgeGraphData, KnowledgeGraphNode, Tag } from "@/types";

// ─── Layout helpers ───────────────────────────────────────────────────────────

interface Point { x: number; y: number }

/** Distribute N items evenly around a circle with the given centre + radius. */
function circleLayout(n: number, cx: number, cy: number, r: number, startAngleDeg = -90): Point[] {
  if (n === 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const angle = ((startAngleDeg + (360 * i) / n) * Math.PI) / 180;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

/**
 * Split a label into at most 2 display lines, each ≤15 chars.
 * Long words are truncated with "…".
 */
function splitLabel(label: string): string[] {
  if (label.length <= 15) return [label];
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const word = w.length > 15 ? w.slice(0, 14) + "…" : w;
    if (!cur) { cur = word; continue; }
    if ((cur + " " + word).length <= 15) {
      cur += " " + word;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length === 1) break; // max 2 lines
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// ─── Node colour palette ─────────────────────────────────────────────────────

interface NodeStyle {
  fill: string;
  stroke: string;
  textFill: string;
  fontWeight: string;
}

function nodeStyle(node: KnowledgeGraphNode): NodeStyle {
  if (node.category === "subject_root") {
    return { fill: "#eff6ff", stroke: "#2563eb", textFill: "#1e40af", fontWeight: "700" };
  }
  if (node.covered) {
    return { fill: "#dbeafe", stroke: "#3b82f6", textFill: "#1d4ed8", fontWeight: "600" };
  }
  if (node.preview) {
    return { fill: "#fef3c7", stroke: "#f59e0b", textFill: "#92400e", fontWeight: "500" };
  }
  return { fill: "#f1f5f9", stroke: "#94a3b8", textFill: "#64748b", fontWeight: "400" };
}

function nodeRadius(node: KnowledgeGraphNode): number {
  if (node.category === "subject_root") return 22;
  if (node.covered) return 15;
  if (node.preview) return 13;
  return 11;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  graphData: KnowledgeGraphData | null;
  /** All tags registered for the parent subject (fallback graph). */
  subjectTags: Tag[];
  /** Tags directly attached to this lesson (fallback graph). */
  lessonTags: Tag[];
  /** Subject title — used in fallback header. */
  subjectTitle: string;
}

export function KnowledgeGraphOrientation({ graphData, subjectTags, lessonTags, subjectTitle }: Props) {
  // ── Resolve what to render ──────────────────────────────────────────────────
  const graph = graphData ?? deriveFallbackGraph(subjectTags, lessonTags, subjectTitle);
  if (!graph || graph.nodes.length === 0) return null;

  // ── Compute positions ───────────────────────────────────────────────────────
  const W = 600, H = 320;
  const cx = W / 2, cy = H / 2 - 10;

  const roots  = graph.nodes.filter(n => n.category === "subject_root");
  const covered = graph.nodes.filter(n => n.covered && n.category !== "subject_root");
  const preview = graph.nodes.filter(n => n.preview && !n.covered);
  const others  = graph.nodes.filter(n => !n.covered && !n.preview && n.category !== "subject_root");

  const posMap = new Map<string, Point>();

  // Root(s) at centre
  roots.forEach((n, i) => {
    posMap.set(n.id, { x: cx + (i - (roots.length - 1) / 2) * 45, y: cy });
  });

  // Covered in inner ring at r=100
  const innerPts = circleLayout(covered.length, cx, cy, 100, -90);
  covered.forEach((n, i) => posMap.set(n.id, innerPts[i]));

  // Preview + others in outer ring at r=170
  const outerNodes = [...preview, ...others];
  const outerPts = circleLayout(outerNodes.length, cx, cy, 170, -90);
  outerNodes.forEach((n, i) => posMap.set(n.id, outerPts[i]));

  // Auto-fill positions for any node not yet placed (shouldn't happen with well-formed data)
  graph.nodes.forEach((n, i) => {
    if (!posMap.has(n.id)) {
      posMap.set(n.id, { x: 40 + (i % 10) * 55, y: 40 + Math.floor(i / 10) * 60 });
    }
  });

  // Derive edges: if none supplied, connect each root to all direct children
  const edges = graph.edges.length > 0
    ? graph.edges
    : graph.nodes
        .filter(n => n.category !== "subject_root")
        .flatMap(n => roots.map(r => ({ from: r.id, to: n.id })));

  // ── Legend items ────────────────────────────────────────────────────────────
  const hasPreview = preview.length > 0;
  const hasOthers  = others.length > 0;

  // ── Bounding box for "high-level" type ────────────────────────────────────
  // Draw a subtle rounded rect around all covered (non-root) nodes.
  let coverBox: { x: number; y: number; w: number; h: number } | null = null;
  if (graph.type === "high-level" && covered.length > 0) {
    const xs = covered.map(n => posMap.get(n.id)!.x);
    const ys = covered.map(n => posMap.get(n.id)!.y);
    const pad = 22;
    coverBox = {
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      w: Math.max(...xs) - Math.min(...xs) + pad * 2,
      h: Math.max(...ys) - Math.min(...ys) + pad * 2,
    };
    // Include root in the box for high-level
    roots.forEach(r => {
      const p = posMap.get(r.id)!;
      coverBox!.x = Math.min(coverBox!.x, p.x - pad);
      coverBox!.y = Math.min(coverBox!.y, p.y - pad);
      coverBox!.w = Math.max(coverBox!.x + coverBox!.w, p.x + pad) - coverBox!.x;
      coverBox!.h = Math.max(coverBox!.y + coverBox!.h, p.y + pad) - coverBox!.y;
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-0.5">
          {graph.type === "high-level" ? "Subject Map" : "Concept Map"}
        </div>
        <h2 className="text-sm font-bold text-gray-800 leading-snug">{graph.title}</h2>
        {graph.description && (
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-2xl">{graph.description}</p>
        )}
      </div>

      {/* SVG graph */}
      <div className="px-2 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ maxHeight: 280 }}
          aria-label={`Knowledge graph: ${graph.title}`}
        >
          {/* Coverage bounding box (high-level view) */}
          {coverBox && (
            <rect
              x={coverBox.x} y={coverBox.y}
              width={coverBox.w} height={coverBox.h}
              rx={16} ry={16}
              fill="#eff6ff"
              stroke="#93c5fd"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          )}

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = posMap.get(edge.from);
            const to   = posMap.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={`e-${i}`}
                x1={from.x} y1={from.y}
                x2={to.x}   y2={to.y}
                stroke="#e2e8f0"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const pos = posMap.get(node.id);
            if (!pos) return null;
            const style = nodeStyle(node);
            const r     = nodeRadius(node);
            const lines = splitLabel(node.label);
            const isRoot = node.category === "subject_root";
            const lineH  = isRoot ? 12 : 10;

            return (
              <g key={node.id} transform={`translate(${pos.x},${pos.y})`}>
                {/* Tooltip on hover */}
                <title>{node.description ?? node.label}</title>

                {/* Glow ring for covered nodes */}
                {node.covered && !isRoot && (
                  <circle r={r + 4} fill="#bfdbfe" opacity={0.4} />
                )}

                <circle
                  r={r}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={isRoot ? 2.5 : 1.8}
                />

                {/* Label below node */}
                <text
                  textAnchor="middle"
                  fontSize={isRoot ? 11 : 9.5}
                  fill={style.textFill}
                  fontWeight={style.fontWeight}
                >
                  {lines.map((line, li) => (
                    <tspan
                      key={li}
                      x={0}
                      dy={li === 0 ? r + lineH : lineH + 1}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-5 pb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-100 border-2 border-blue-500 inline-block shrink-0" />
          Covered in this lesson
        </span>
        {hasPreview && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-50 border-2 border-amber-400 inline-block shrink-0" />
            Preview — explored later
          </span>
        )}
        {hasOthers && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-100 border-2 border-slate-400 inline-block shrink-0" />
            Not yet covered
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Fallback graph derived from DB tags ──────────────────────────────────────

/**
 * When a lesson has no authored `knowledge_graph_data`, build a minimal graph
 * from the subject's tag vocabulary and the lesson's own tags.
 * This ensures every lesson shows an orientation even before the authoring
 * contract requires it.
 */
function deriveFallbackGraph(
  subjectTags: Tag[],
  lessonTags: Tag[],
  subjectTitle: string
): KnowledgeGraphData | null {
  if (subjectTags.length === 0 && lessonTags.length === 0) return null;

  const lessonTagIds = new Set(lessonTags.map(t => t.id));

  // Deduplicate: combine subject tags and any lesson-only tags
  const allTagMap = new Map<number, Tag>();
  [...subjectTags, ...lessonTags].forEach(t => allTagMap.set(t.id, t));
  const allTags = Array.from(allTagMap.values());

  const rootNode: KnowledgeGraphNode = {
    id: "__root__",
    label: subjectTitle.length > 20 ? subjectTitle.slice(0, 19) + "…" : subjectTitle,
    category: "subject_root",
    covered: true,
  };

  const tagNodes: KnowledgeGraphNode[] = allTags
    .filter(t => t.tag_type === "concept" || t.tag_type === "curriculum_area")
    .slice(0, 12) // limit to 12 for readability
    .map(t => ({
      id: `tag-${t.id}`,
      label: t.name.replace(/-/g, " "),
      category: "concept" as const,
      covered: lessonTagIds.has(t.id),
    }));

  if (tagNodes.length === 0) return null;

  const edges = tagNodes.map(n => ({ from: rootNode.id, to: n.id }));

  const coveredCount = tagNodes.filter(n => n.covered).length;
  const type: "high-level" | "focused" =
    coveredCount >= tagNodes.length * 0.5 ? "high-level" : "focused";

  return {
    type,
    title: `${subjectTitle} — concept overview`,
    nodes: [rootNode, ...tagNodes],
    edges,
  };
}
