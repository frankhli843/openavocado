import type { ArtifactBuildStatus } from "./types";

export function hostnameFromRequestHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end >= 0 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.split(":")[0] ?? null;
}

export function isLocalSandboxQaHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function canServeArtifactSandbox({
  buildStatus,
  qaMode,
  hostname,
}: {
  buildStatus: ArtifactBuildStatus;
  qaMode: string | null | undefined;
  hostname: string | null | undefined;
}): boolean {
  if (buildStatus === "qa_approved") return true;
  return buildStatus === "pending_qa" && qaMode === "pending" && isLocalSandboxQaHost(hostname);
}
