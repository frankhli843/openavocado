/**
 * GET    /api/visual-artifacts/[slug]        — get a single artifact
 * PATCH  /api/visual-artifacts/[slug]        — update source/manifest (resets build)
 * POST   /api/visual-artifacts/[slug]/build  — trigger/retry build
 * POST   /api/visual-artifacts/[slug]/approve — approve after QA
 * POST   /api/visual-artifacts/[slug]/reject  — reject after QA
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  getArtifactBySlug,
  updateSource,
  markBuilding,
  markBuildSuccess,
  markBuildFailed,
} from "@/lib/visual-artifacts/db";
import { buildArtifact } from "@/lib/visual-artifacts/build";

type Params = { slug: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const artifact = getArtifactBySlug(slug);
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ artifact });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  try {
    const body = (await req.json()) as {
      source_react?: string;
      manifest?: { allowed_imports?: string[] };
    };
    if (!body.source_react) {
      return NextResponse.json({ error: "source_react is required" }, { status: 400 });
    }
    const artifact = updateSource(slug, body.source_react, body.manifest);
    // Trigger rebuild
    triggerBuildAsync(artifact.slug, artifact.source_react, artifact.manifest).catch(() => {});
    return NextResponse.json({ artifact });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

async function triggerBuildAsync(
  slug: string,
  source: string,
  manifest: { allowed_imports: string[] }
) {
  markBuilding(slug);
  const result = await buildArtifact(slug, source, manifest);
  if (result.ok) {
    markBuildSuccess(slug, result);
  } else {
    markBuildFailed(slug, result);
  }
}
