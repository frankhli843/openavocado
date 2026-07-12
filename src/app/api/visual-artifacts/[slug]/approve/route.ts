/** POST /api/visual-artifacts/[slug]/approve — approve artifact after QA */
import { NextResponse, type NextRequest } from "next/server";
import { getArtifactBySlug, approveArtifact } from "@/lib/visual-artifacts/db";

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
    approved_by?: string;
  };

  try {
    const approved = approveArtifact(slug, body);
    return NextResponse.json({ artifact: approved });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
