"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { SegmentedControl } from "@/lib/widgets/schema";
import { Segmented } from "./Controls";
import type { WidgetStateChange } from "./DeclarativeWidget";

type Focus = "hierarchy" | "compute" | "data" | "iam";

const focusValues: Focus[] = ["hierarchy", "compute", "data", "iam"];

const focusControl: SegmentedControl = {
  type: "segmented",
  id: "focus",
  label: "Concept map",
  default: 0,
  options: [
    { label: "Hierarchy", value: 0 },
    { label: "Compute", value: 1 },
    { label: "Data", value: 2 },
    { label: "IAM", value: 3 },
  ],
};

const computeControl: SegmentedControl = {
  type: "segmented",
  id: "compute",
  label: "AWS compute anchor",
  default: 0,
  options: [
    { label: "ECS/Fargate", value: 0 },
    { label: "EKS", value: 1 },
    { label: "EC2", value: 2 },
    { label: "Lambda", value: 3 },
  ],
};

const dataControl: SegmentedControl = {
  type: "segmented",
  id: "data",
  label: "Data need",
  default: 0,
  options: [
    { label: "Objects", value: 0 },
    { label: "Events", value: 1 },
    { label: "SQL", value: 2 },
    { label: "Analytics", value: 3 },
  ],
};

const principalControl: SegmentedControl = {
  type: "segmented",
  id: "principal",
  label: "Principal",
  default: 1,
  options: [
    { label: "User", value: 0 },
    { label: "Service account", value: 1 },
    { label: "Group", value: 2 },
  ],
};

const computeMap = [
  { aws: "ECS/Fargate", gcp: "Cloud Run", manages: "container image and request settings", gcpManages: "servers, autoscaling, routing" },
  { aws: "EKS", gcp: "GKE", manages: "Kubernetes objects and cluster policy", gcpManages: "managed control plane and node options" },
  { aws: "EC2", gcp: "Compute Engine", manages: "VM size, OS, patching, networking", gcpManages: "hypervisor and cloud primitives" },
  { aws: "Lambda", gcp: "Cloud Functions", manages: "function code and triggers", gcpManages: "runtime, scale, event integration" },
];

const dataMap = [
  { need: "Object files", aws: "S3", gcp: "Cloud Storage", reason: "durable blobs and static assets" },
  { need: "Event queue", aws: "SQS/SNS", gcp: "Pub/Sub", reason: "decoupled event fanout and buffering" },
  { need: "SQL database", aws: "RDS/Aurora", gcp: "Cloud SQL/Spanner", reason: "relational transactions and managed operations" },
  { need: "Analytics", aws: "Redshift/Athena", gcp: "BigQuery", reason: "serverless warehouse queries over large datasets" },
];

const principals = [
  { who: "user:learner@example.com", role: "roles/viewer", scope: "project or folder", aws: "IAM user / IAM Identity Center permission set" },
  { who: "serviceAccount:api@project.iam.gserviceaccount.com", role: "roles/run.invoker", scope: "single service or project", aws: "IAM role assumed by workload" },
  { who: "group:engineering@example.com", role: "roles/editor", scope: "folder or project", aws: "IAM Identity Center group assignment" },
];

export function GcpAwsMapLabWidget({
  params,
  initialState,
  onStateChange,
}: {
  params?: { focus?: Focus };
  initialState?: Record<string, number>;
  onStateChange?: (state: WidgetStateChange) => void;
}) {
  const defaultFocus = Math.max(0, focusValues.indexOf(params?.focus ?? "hierarchy"));
  const defaults = useMemo(() => ({ focus: defaultFocus, compute: 0, data: 0, principal: 1 }), [defaultFocus]);
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...defaults, ...(initialState ?? {}) }));

  function update(id: string, value: number) {
    const next = { ...values, [id]: value };
    setValues(next);
    onStateChange?.({ controls: next });
  }

  const focus = focusValues[Math.max(0, Math.min(3, values.focus ?? defaultFocus))];
  const compute = computeMap[Math.max(0, Math.min(computeMap.length - 1, values.compute ?? 0))];
  const data = dataMap[Math.max(0, Math.min(dataMap.length - 1, values.data ?? 0))];
  const principal = principals[Math.max(0, Math.min(principals.length - 1, values.principal ?? 1))];

  return (
    <div className="space-y-5">
      <Segmented control={focusControl} value={values.focus} onChange={(v) => update("focus", v)} />

      {focus === "hierarchy" && <HierarchyView />}
      {focus === "compute" && (
        <MapView
          control={<Segmented control={computeControl} value={values.compute} onChange={(v) => update("compute", v)} />}
          leftTitle={compute.aws}
          rightTitle={compute.gcp}
          bridge="Same workload question, different default abstraction"
          details={[`You manage: ${compute.manages}`, `GCP manages: ${compute.gcpManages}`]}
        />
      )}
      {focus === "data" && (
        <MapView
          control={<Segmented control={dataControl} value={values.data} onChange={(v) => update("data", v)} />}
          leftTitle={data.aws}
          rightTitle={data.gcp}
          bridge={data.need}
          details={[`Use when: ${data.reason}`, "The concept is workload fit, not memorizing service names."]}
        />
      )}
      {focus === "iam" && (
        <IamView
          principal={principal}
          control={<Segmented control={principalControl} value={values.principal} onChange={(v) => update("principal", v)} />}
        />
      )}
    </div>
  );
}

function HierarchyView() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">GCP resource hierarchy</div>
        <div className="space-y-2">
          <Level label="Organization" detail="acme.com" tone="blue" />
          <Connector />
          <div className="grid grid-cols-2 gap-2">
            <Level label="Folder" detail="Engineering" tone="green" />
            <Level label="Folder" detail="Data" tone="green" />
          </div>
          <Connector />
          <div className="grid grid-cols-2 gap-2">
            <Level label="Project" detail="prod-api" tone="amber" />
            <Level label="Project" detail="warehouse" tone="amber" />
          </div>
          <Connector />
          <div className="grid grid-cols-2 gap-2">
            <Level label="Resource" detail="Cloud Run, SQL" tone="red" />
            <Level label="Resource" detail="BigQuery, GCS" tone="red" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
        A GCP project is the main workload container. Folders and organizations are governance containers above it. IAM grants flow downward, so a folder-level role can affect every project under that folder.
      </div>
    </div>
  );
}

function MapView({
  control,
  leftTitle,
  rightTitle,
  bridge,
  details,
}: {
  control: ReactNode;
  leftTitle: string;
  rightTitle: string;
  bridge: string;
  details: string[];
}) {
  return (
    <div className="space-y-4">
      {control}
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <CloudCard label="AWS anchor" title={leftTitle} tone="orange" />
        <div className="rounded-full bg-slate-900 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">maps to</div>
        <CloudCard label="GCP target" title={rightTitle} tone="blue" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="font-semibold text-slate-950">{bridge}</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
          {details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      </div>
    </div>
  );
}

function IamView({ principal, control }: { principal: typeof principals[number]; control: ReactNode }) {
  return (
    <div className="space-y-4">
      {control}
      <div className="grid gap-3 md:grid-cols-3">
        <CloudCard label="Who" title={principal.who} tone="green" />
        <CloudCard label="Role" title={principal.role} tone="amber" />
        <CloudCard label="Where" title={principal.scope} tone="red" />
      </div>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
        GCP IAM binding is Who + Role + Resource. AWS has the same underlying question, but the visible machinery differs: {principal.aws}.
      </div>
    </div>
  );
}

function Level({ label, detail, tone }: { label: string; detail: string; tone: "blue" | "green" | "amber" | "red" }) {
  const classes = {
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-rose-200 bg-rose-50 text-rose-950",
  }[tone];
  return (
    <div className={`rounded-xl border px-3 py-3 ${classes}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 font-semibold">{detail}</div>
    </div>
  );
}

function CloudCard({ label, title, tone }: { label: string; title: string; tone: "orange" | "blue" | "green" | "amber" | "red" }) {
  const classes = {
    orange: "border-orange-200 bg-orange-50 text-orange-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-rose-200 bg-rose-50 text-rose-950",
  }[tone];
  return (
    <div className={`min-w-0 rounded-xl border px-4 py-4 ${classes}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 break-words text-lg font-bold leading-tight">{title}</div>
    </div>
  );
}

function Connector() {
  return <div className="mx-auto h-4 w-px bg-slate-300" aria-hidden="true" />;
}
