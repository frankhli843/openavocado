/** POST /api/visual-artifacts/[slug]/reject — reject artifact after QA */
import { NextResponse, type NextRequest } from "next/server";
import { getArtifactBySlug, rejectArtifact } from "@/lib/visual-artifacts/db";

type Params = { slug: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const artifact = getArtifactBySlug(slug);
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { qa_notes?: string };

  try {
    const rejected = rejectArtifact(slug, body.qa_notes ?? "Rejected without notes.");
    return NextResponse.json({ artifact: rejected });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
