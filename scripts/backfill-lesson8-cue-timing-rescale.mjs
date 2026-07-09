/**
 * Re-cue + rescale Lesson 8 "GCP Through an AWS Lens" synced-visual cue
 * timelines to the REAL audio duration AND real lesson content.
 *
 * Like Lesson 11, Lesson 8's DB cues are generic placeholder skeletons emitted
 * by the Gemini prodavo generator: labels like "Input / Transform / Handoff"
 * and "High-level map / Analogy / ..." with narrations like "Locate the lesson
 * before details for GCP Through an AWS Lens...". They also drift badly
 * (orientation span 900s vs 1078.97s audio; each part span 180s vs ~412-446s
 * audio). A plain proportional stretch would just lengthen placeholder text, so
 * this script REPLACES each cue's boundaries, label, headline, narration, and
 * active_elements with content-specific values derived from the real spoken
 * transcript / part scripts (activity 45 transcript, parts 46/47/48/49 scripts),
 * while preserving cue count and every other field of the cue object.
 *
 * The new boundaries divide the real audio duration evenly across the existing
 * cue count (orientation 7, each part 3), matching the one-staged-diagram-per-
 * cue Manim authoring pattern. Monotonic, non-overlapping, last-cue-ends-at-
 * real-duration is enforced.
 *
 * Cue containers differ by activity:
 *   - act 45 (orientation): content.orientation_visual.cues
 *   - act 46/47/48/49 (lesson_part): content.audio.synced_visual.cues
 *
 * Idempotent: skips an activity whose cue0 label already matches the new
 * content. Snapshot the DB before running (caller does this:
 * data/backups/avocadocore.db.pre-l8-recue.*).
 *
 * Run from repo root under node 22:
 *   AVOCADOCORE_DB_PATH=<live>/data/avocadocore.db \
 *     node scripts/backfill-lesson8-cue-timing-rescale.mjs
 */
import Database from "better-sqlite3";

const DB_PATH = process.env.AVOCADOCORE_DB_PATH || "data/avocadocore.db";

// Real audio durations (artifact duration_sec from the exported storyboards).
const REAL_DURATION = {
  45: 1078.97, // lesson_8_audio.mp3 (full orientation)
  46: 412.58,  // Part 1: Resource Hierarchy
  47: 417.5,   // Part 2: Compute and Containers
  48: 446.21,  // Part 3: Storage and Messaging
  49: 438.26,  // Part 4: IAM and Cloud Identity
};

// act 45 lives in content.orientation_visual.cues; the parts in
// content.audio.synced_visual.cues.
const ORIENTATION_ID = 45;

// New content-specific cues per activity (boundaries filled in below by even
// division across the real duration; only label/headline/narration/active are
// authored here in cue order).
const CONTENT = {
  // Orientation: 7 cues — the standard map/analogy/example/mechanism/impl/
  // misconception/synthesis arc, filled with real GCP-through-AWS content.
  45: [
    { label: "High-level map",
      headline: "One object: a cloud resource request",
      narration: "Locate the lesson before the details. The object we follow is a single cloud resource request that must live in the right account boundary and identity model. The goal is not to memorize a translation table, but to see where GCP draws its boundaries differently from AWS.",
      active: ["object: resource request", "boundary + identity"] },
    { label: "Analogy",
      headline: "Two office buildings, different floor plans",
      narration: "Moving from AWS to GCP is like moving between two office buildings. Both have rooms, badges, teams, and budgets — but the floor plan and the badge rules are different. The analogy gives traction; the real understanding comes from the boundaries underneath.",
      active: ["AWS building", "GCP building"] },
    { label: "Tiny example",
      headline: "Account + roles vs org, folder, project, SA",
      narration: "In AWS you often start with an account and IAM roles. In GCP you start with an organization, folders, projects, service accounts, and IAM bindings on resources. The small version keeps the same relationships as the real system.",
      active: ["AWS: account + roles", "GCP: org/folder/project/SA"] },
    { label: "Mechanism",
      headline: "Project, bindings, service accounts, enabled APIs",
      narration: "A GCP project is the main resource and billing container. IAM bindings attach principals to roles on resources. Service accounts are the identities workloads use. APIs must be enabled before services can be used. Networks, storage, and compute all inherit the project and IAM model.",
      active: ["project = container", "binding + SA + API"] },
    { label: "Implementation",
      headline: "Which project, principal, role, API?",
      narration: "In practice the useful check is four questions: which project owns this resource, which principal is acting, which role grants the permission, and which API or quota blocks it. If those line up, the concept is usable, not just memorized.",
      active: ["project? principal?", "role? API/quota?"] },
    { label: "Misconception",
      headline: "One AWS account is not always one project",
      narration: "The common mistake is mapping one AWS account directly to one GCP project in every situation. Sometimes that works, but the organization and folder layers matter — the mistake happens when the label becomes louder than the object.",
      active: ["1 account = 1 project?", "org + folders matter"] },
    { label: "Synthesis",
      headline: "Familiar only after you respect the boundaries",
      narration: "The takeaway: GCP feels familiar only after you respect its project and identity boundaries. The contract behind every request is identity plus resource plus role plus scope. Keep the object visible and the rest of the lesson stops being mysterious.",
      active: ["identity + resource", "role + scope"] },
  ],
  // Part 1: GCP's Resource Hierarchy — 3 cues.
  46: [
    { label: "The four-layer tree",
      headline: "Organization to Folder to Project to Resource",
      narration: "GCP organizes every resource into a strict four-layer hierarchy: Organization, then Folder, then Project, then Resource. Unlike AWS, where an account is a largely flat isolation boundary, GCP projects are always nested inside this tree — you cannot create a resource outside a project.",
      active: ["Org > Folder > Project > Resource", "AWS: flat account"] },
    { label: "Policies cascade down",
      headline: "The project is the billing and API boundary",
      narration: "IAM policies cascade downward through the tree, so a role granted on a folder flows to every project beneath it. The Project is the fundamental unit: it defines the billing boundary and the API-enablement boundary. Folders are an optional grouping layer for departments, teams, or environments, and they can nest.",
      active: ["IAM cascades down", "Project = billing + API"] },
    { label: "Every resource has a home",
      headline: "Exactly one project, and it scales better",
      narration: "Every resource — a VM, a bucket, a database, a Cloud Run service — must belong to exactly one Project, and every project belongs somewhere in this tree. This is more structured than AWS, but it scales better for large organizations.",
      active: ["resource -> one project", "structured, scales"] },
  ],
  // Part 2: Compute and Containers — 3 cues.
  47: [
    { label: "Name mapping",
      headline: "Cloud Run, Artifact Registry, GKE",
      narration: "GCP compute maps almost directly onto your AWS knowledge. Cloud Run is GCP's answer to Fargate with ECS. Artifact Registry is the equivalent of ECR, where you push your container images. And GKE, Google Kubernetes Engine, is the counterpart to EKS.",
      active: ["Cloud Run <-> Fargate/ECS", "Artifact Registry <-> ECR"] },
    { label: "Cloud Run scales to zero",
      headline: "Zero instances, then a cold start",
      narration: "The biggest behavioral difference: Cloud Run scales to zero by default. When no requests arrive, it shuts down every instance and charges you nothing. When a request comes in, it spins up within a few hundred milliseconds. That is great for variable traffic, but it introduces cold starts that Fargate does not have.",
      active: ["no requests -> 0 instances -> $0", "request -> cold start"] },
    { label: "GKE is real Kubernetes",
      headline: "Managed control plane, born at Google",
      narration: "GKE runs actual Kubernetes clusters — you deploy Pods, Services, Deployments, and StatefulSets exactly as anywhere else. Kubernetes was created at Google and open-sourced in 2014, and GKE manages the control plane, etcd, and node upgrades for you.",
      active: ["Pods/Services/Deployments", "managed control plane + etcd"] },
  ],
  // Part 3: Storage and Messaging — 3 cues.
  48: [
    { label: "Buckets and a topic",
      headline: "GCS is S3; Pub/Sub is SQS plus SNS",
      narration: "Cloud Storage, or GCS, is GCP's S3: named buckets holding objects, with globally unique bucket names and the same flat key-value model. Pub/Sub is GCP's managed messaging service, combining the capabilities of both AWS SQS and SNS into one system.",
      active: ["GCS buckets <-> S3", "Pub/Sub <-> SQS + SNS"] },
    { label: "Storage classes by access",
      headline: "Standard to Nearline to Coldline to Archive",
      narration: "GCS has storage classes that match S3's tiers, chosen by how often you read the data: Standard for frequent access, Nearline for about once a month, Coldline for once a quarter, and Archive for once a year. GCS also uses uniform bucket-level access by default, encouraging IAM over per-object ACLs.",
      active: ["Standard > Nearline > Coldline > Archive", "colder = cheaper"] },
    { label: "Publish, then subscribe",
      headline: "Push and pull, not pull-only",
      narration: "In Pub/Sub, producers publish messages to a topic and consumers subscribe to receive them. Unlike SQS, which is pull-only, Pub/Sub supports both push delivery, where Google pushes to your HTTPS endpoint, and pull delivery, where your service polls. It was built for Google-scale event streaming.",
      active: ["topic -> subscribers", "push AND pull"] },
  ],
  // Part 4: IAM and Cloud Identity — 3 cues.
  49: [
    { label: "Who, what, where",
      headline: "A binding of principal, role, resource",
      narration: "GCP IAM answers a single question: which principal can perform which actions on which resources? Every IAM policy is a binding of three things: a principal, the who; a role, the what they can do; and a resource, the where they can do it.",
      active: ["principal (who)", "role (what) + resource (where)"] },
    { label: "Principals and roles",
      headline: "Users, service accounts, groups, domains",
      narration: "Principals can be Google user accounts, service accounts for machine identities, Google groups, or a whole Cloud Identity domain. Roles come in three kinds: Basic roles like Owner, Editor, and Viewer, which are very broad; Predefined roles curated by Google; and Custom roles where you define the exact permission set.",
      active: ["user / SA / group / domain", "Basic / Predefined / Custom"] },
    { label: "Bind and let the machine act",
      headline: "Service accounts replace credential juggling",
      narration: "A binding grants, for example, user frank the role roles slash run dot developer on the project prod-api. Service accounts are machine identities that let workloads act without long-lived keys, eliminating whole classes of credential-management problems.",
      active: ["grant role on resource", "service accounts = machine identity"] },
  ],
};

const db = new Database(DB_PATH);
const log = [];

function evenBoundaries(n, total) {
  const b = [];
  for (let i = 0; i < n; i++) {
    const start = Math.round((total * i) / n);
    const end = i === n - 1 ? Math.round(total) : Math.round((total * (i + 1)) / n);
    b.push([start, end]);
  }
  for (let i = 1; i < b.length; i++) {
    if (b[i][0] < b[i - 1][1]) b[i][0] = b[i - 1][1];
    if (b[i][1] <= b[i][0]) b[i][1] = b[i][0] + 1;
  }
  return b;
}

const tx = db.transaction(() => {
  for (const aid of [45, 46, 47, 48, 49]) {
    const row = db.prepare("SELECT content FROM lesson_activities WHERE id=?").get(aid);
    if (!row) { log.push(`act ${aid}: MISSING`); continue; }
    const c = JSON.parse(row.content);
    const isOrientation = aid === ORIENTATION_ID;
    const sv = isOrientation ? c.orientation_visual : c.audio?.synced_visual;
    if (!sv || !Array.isArray(sv.cues)) { log.push(`act ${aid}: no cues container`); continue; }
    const cues = sv.cues;
    const content = CONTENT[aid];
    const real = REAL_DURATION[aid];

    if (cues.length !== content.length) {
      log.push(`act ${aid}: cue count ${cues.length} != content ${content.length} — SKIPPED (manual check)`);
      continue;
    }
    // Idempotency: compare headline (not label — the orientation placeholder
    // reused the same standard-arc labels as our content, so label match is a
    // false positive; headlines are content-specific and reliably differ).
    if (cues[0]?.headline === content[0].headline) {
      log.push(`act ${aid}: already re-cued (cue0 headline matches), skipped`);
      continue;
    }

    const bounds = evenBoundaries(cues.length, real);
    for (let i = 0; i < cues.length; i++) {
      const q = cues[i];
      const [s, e] = bounds[i];
      q.index = i;
      q.start = s;
      q.end = e;
      q.duration = e - s;
      q.label = content[i].label;
      q.headline = content[i].headline;
      q.narration = content[i].narration;
      q.active_elements = content[i].active;
    }
    if (isOrientation) {
      c.duration_hint = real;
    } else if (c.audio) {
      c.audio.duration_hint = real;
    }
    db.prepare("UPDATE lesson_activities SET content=? WHERE id=?")
      .run(JSON.stringify(c), aid);
    const last = cues[cues.length - 1];
    log.push(`act ${aid}: re-cued ${cues.length} cues, last ends ${last.end}s (real ${real}s), duration_hint=${real}`);
  }
});

tx();
db.close();
for (const l of log) console.log(l);
