/**
 * GET  /api/visual-artifacts        — list all artifacts (optional ?build_status= filter)
 * POST /api/visual-artifacts        — create a new artifact (source stored, build triggered async)
 */
import { NextResponse } from "next/server";
import { createArtifact, listArtifacts, markBuilding, markBuildSuccess, markBuildFailed } from "@/lib/visual-artifacts/db";
import { buildArtifact } from "@/lib/visual-artifacts/build";
import type { ArtifactBuildStatus } from "@/lib/visual-artifacts/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const build_status = url.searchParams.get("build_status") as ArtifactBuildStatus | null;
    const artifacts = listArtifacts(build_status ? { build_status } : undefined);
    return NextResponse.json({ artifacts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      slug?: string;
      title?: string;
      source_react?: string;
      manifest?: { allowed_imports?: string[] };
      lesson_id?: number;
      activity_id?: number;
    };

    if (!body.slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
    if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (!body.source_react) return NextResponse.json({ error: "source_react is required" }, { status: 400 });

    const artifact = createArtifact({
      slug: body.slug,
      title: body.title,
      source_react: body.source_react,
      manifest: body.manifest,
      lesson_id: body.lesson_id,
      activity_id: body.activity_id,
    });

    // Trigger build asynchronously (fire and forget; poll /api/visual-artifacts/[slug] for status)
    triggerBuildAsync(artifact.slug, artifact.source_react, artifact.manifest).catch(() => {});

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("UNIQUE constraint") || msg.includes("already exists")) {
      return NextResponse.json({ error: `Slug already exists. Use a unique slug.` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Start a build in the background. Updates DB status as it progresses. */
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
