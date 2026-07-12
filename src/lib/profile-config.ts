/**
 * Learner-profile config serialization.
 *
 * A profile's `config` is a privacy-safe JSON object of learner notes,
 * preferences, and context that guides lesson generation. We accept either an
 * object or a JSON string and normalize to a stored JSON string (or null).
 */

/** Sentinel returned when a config value is not a JSON object. */
export const INVALID_CONFIG = Symbol("invalid_config");

/**
 * Normalize a config value to a JSON string, null, or INVALID_CONFIG. Arrays
 * and primitives are rejected so config stays an object map.
 */
export function serializeConfig(config: unknown): string | null | typeof INVALID_CONFIG {
  if (config == null) return null;
  if (typeof config === "string") {
    const trimmed = config.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return JSON.stringify(parsed);
      }
      return INVALID_CONFIG;
    } catch {
      return INVALID_CONFIG;
    }
  }
  if (typeof config === "object" && !Array.isArray(config)) {
    return JSON.stringify(config);
  }
  return INVALID_CONFIG;
}
