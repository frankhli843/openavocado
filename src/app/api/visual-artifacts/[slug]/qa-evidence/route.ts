/**
 * POST /api/visual-artifacts/[slug]/qa-evidence
 *
 * Attach Chrome MCP QA evidence (snapshot/screenshot refs + notes) to an
 * artifact record without changing its build_status. Separate from /approve so
 * evidence can be recorded for already-approved artifacts or on re-QA.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getArtifactBySlug, recordQaEvidence } from "@/lib/visual-artifacts/db";

type Params = { slug: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const artifact = getArtifactBySlug(slug);
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    qa_notes?: string;
    qa_snapshot_ref?: string;
    qa_screenshot_ref?: string;
  };

  try {
    const updated = recordQaEvidence(slug, body);
    return NextResponse.json({ artifact: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
