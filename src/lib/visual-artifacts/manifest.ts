/**
 * Manifest validation and import allowlist enforcement.
 *
 * The manifest controls what the build pipeline allows in artifact source.
 * Imports not in the allowlist cause the build to fail (not silently skip).
 */

import type { ArtifactManifest } from "./types";
import { DEFAULT_ALLOWED_IMPORTS } from "./types";

/** Parse a manifest JSON string. Merges defaults for missing fields. */
export function parseManifest(raw: string): ArtifactManifest {
  let parsed: Partial<ArtifactManifest>;
  try {
    parsed = JSON.parse(raw) as Partial<ArtifactManifest>;
  } catch {
    throw new Error(`Invalid manifest JSON: ${raw.slice(0, 80)}`);
  }
  return {
    allowed_imports: parsed.allowed_imports ?? DEFAULT_ALLOWED_IMPORTS,
    params_schema: parsed.params_schema,
    runtime_constraints: parsed.runtime_constraints ?? {
      allow_fetch: false,
      allow_storage: false,
    },
  };
}

/** Normalize and validate a manifest from user input. Returns errors. */
export function validateManifest(manifest: Partial<ArtifactManifest>): {
  valid: boolean;
  errors: string[];
  normalized: ArtifactManifest;
} {
  const errors: string[] = [];
  const allowed = manifest.allowed_imports ?? DEFAULT_ALLOWED_IMPORTS;

  if (!Array.isArray(allowed) || allowed.some((s) => typeof s !== "string")) {
    errors.push("allowed_imports must be an array of strings");
  }

  // Hard restrictions: some import specifiers are never allowed regardless of manifest
  const ALWAYS_BLOCKED = ["fs", "path", "child_process", "net", "http", "https", "crypto"];
  for (const blocked of ALWAYS_BLOCKED) {
    if (allowed.includes(blocked)) {
      errors.push(`"${blocked}" is not allowed in visual artifacts`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      allowed_imports: allowed,
      params_schema: manifest.params_schema,
      runtime_constraints: manifest.runtime_constraints ?? {
        allow_fetch: false,
        allow_storage: false,
      },
    },
  };
}

/**
 * Scan source code for import declarations and return specifiers found.
 * This is a fast regex-based scan (not a full AST parse). The build step
 * does the authoritative compile-time enforcement; this is a pre-flight check.
 */
export function scanImports(source: string): string[] {
  const specifiers: string[] = [];
  // Match: import ... from 'specifier' or "specifier"
  const staticImport = /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = staticImport.exec(source)) !== null) {
    specifiers.push(m[1]);
  }
  // Match: require('specifier')
  const requireImport = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = requireImport.exec(source)) !== null) {
    specifiers.push(m[1]);
  }
  return [...new Set(specifiers)];
}

/** Return import specifiers from source that are NOT in the allowed list. */
export function findBlockedImports(
  source: string,
  allowedImports: string[]
): string[] {
  const found = scanImports(source);
  return found.filter((spec) => {
    // Relative imports are always allowed (within-package)
    if (spec.startsWith(".") || spec.startsWith("/")) return false;
    // Scope prefix match: "react" allows "react", "react/something"
    return !allowedImports.some(
      (allowed) => spec === allowed || spec.startsWith(allowed + "/")
    );
  });
}
