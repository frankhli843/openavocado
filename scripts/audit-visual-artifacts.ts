import Database from "better-sqlite3";
import { validateArtifactApprovalEvidence, validateArtifactSource } from "../src/lib/visual-artifacts/source-validation";

type ArtifactRow = {
  slug: string;
  build_status: string;
  source_react: string | null;
  qa_notes: string | null;
  qa_snapshot_ref: string | null;
  qa_screenshot_ref: string | null;
};

type ActivityRow = {
  activity_id: number;
  lesson_id: number;
  lesson_status: string;
  content: string | null;
};

const dbPath = process.env.AVOCADOCORE_DB_PATH ?? "data/avocadocore.db";
const strict = process.argv.includes("--strict");
const json = process.argv.includes("--json");

const db = new Database(dbPath, { readonly: true });

const approvedRows = db
  .prepare(
    "select slug, build_status, source_react, qa_notes, qa_snapshot_ref, qa_screenshot_ref from visual_artifacts where build_status = ? order by slug"
  )
  .all("qa_approved") as ArtifactRow[];

const referenced = collectReferencedSlugs();

const approvedSourceFailures = approvedRows
  .map((row) => ({ slug: row.slug, errors: validateArtifactSource(row.source_react ?? "").errors }))
  .filter((row) => row.errors.length > 0);

const approvedEvidenceFailures = approvedRows
  .map((row) => ({ slug: row.slug, errors: validateArtifactApprovalEvidence(row).errors }))
  .filter((row) => row.errors.length > 0);

const referencedFailures: Array<{
  slug: string;
  activityIds: number[];
  missing?: true;
  status?: string;
  sourceErrors?: string[];
  evidenceErrors?: string[];
}> = [];

for (const [slug, activityIds] of referenced) {
  const artifact = db
    .prepare(
      "select slug, build_status, source_react, qa_notes, qa_snapshot_ref, qa_screenshot_ref from visual_artifacts where slug = ?"
    )
    .get(slug) as ArtifactRow | undefined;
  if (!artifact) {
    referencedFailures.push({ slug, activityIds: [...activityIds].sort((a, b) => a - b), missing: true });
    continue;
  }
  const sourceErrors = validateArtifactSource(artifact.source_react ?? "").errors;
  const evidenceErrors = validateArtifactApprovalEvidence(artifact).errors;
  if (artifact.build_status !== "qa_approved" || sourceErrors.length > 0 || evidenceErrors.length > 0) {
    referencedFailures.push({
      slug,
      activityIds: [...activityIds].sort((a, b) => a - b),
      status: artifact.build_status,
      sourceErrors,
      evidenceErrors,
    });
  }
}

const report = {
  dbPath,
  approvedCount: approvedRows.length,
  referencedCount: referenced.size,
  approvedSourceFailureCount: approvedSourceFailures.length,
  approvedEvidenceFailureCount: approvedEvidenceFailures.length,
  referencedFailureCount: referencedFailures.length,
  approvedSourceFailures,
  approvedEvidenceFailures,
  referencedFailures,
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`visual artifact audit: ${dbPath}`);
  console.log(`approved artifacts: ${report.approvedCount}`);
  console.log(`referenced artifact slugs: ${report.referencedCount}`);
  console.log(`approved source failures: ${report.approvedSourceFailureCount}`);
  console.log(`approved QA evidence failures: ${report.approvedEvidenceFailureCount}`);
  console.log(`referenced failures: ${report.referencedFailureCount}`);
  for (const failure of referencedFailures.slice(0, 30)) {
    console.log(`- ${failure.slug}: ${failure.missing ? "missing" : failure.status}`);
    for (const error of [...(failure.sourceErrors ?? []), ...(failure.evidenceErrors ?? [])].slice(0, 4)) {
      console.log(`  - ${error}`);
    }
  }
}

if (strict && (approvedSourceFailures.length > 0 || referencedFailures.length > 0)) {
  process.exitCode = 1;
}

function collectReferencedSlugs(): Map<string, Set<number>> {
  const refs = new Map<string, Set<number>>();
  const activities = db
    .prepare(
      `select la.id activity_id, la.lesson_id, l.status lesson_status, la.content
       from lesson_activities la
       join lessons l on l.id = la.lesson_id
       where l.status in ('queued', 'in_progress', 'completed')`
    )
    .all() as ActivityRow[];

  for (const row of activities) {
    const text = row.content ?? "";
    for (const match of text.matchAll(/"artifact_slug"\s*:\s*"([a-z0-9-]+)"/g)) {
      const set = refs.get(match[1]) ?? new Set<number>();
      set.add(row.activity_id);
      refs.set(match[1], set);
    }
  }
  return refs;
}
