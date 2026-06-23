/**
 * Tests for learner-profile config serialization.
 */
import { describe, it, expect } from "vitest";
import { serializeConfig, INVALID_CONFIG } from "@/lib/profile-config";

describe("serializeConfig", () => {
  it("returns null for null/undefined/empty", () => {
    expect(serializeConfig(null)).toBeNull();
    expect(serializeConfig(undefined)).toBeNull();
    expect(serializeConfig("")).toBeNull();
    expect(serializeConfig("   ")).toBeNull();
  });

  it("serializes a plain object to JSON", () => {
    const out = serializeConfig({ notes: "prefers visual examples", pace: "fast" });
    expect(out).toBe(JSON.stringify({ notes: "prefers visual examples", pace: "fast" }));
  });

  it("accepts and re-serializes a JSON object string", () => {
    const out = serializeConfig('{"notes":"hi"}');
    expect(out).toBe('{"notes":"hi"}');
  });

  it("rejects arrays", () => {
    expect(serializeConfig([1, 2, 3])).toBe(INVALID_CONFIG);
  });

  it("rejects primitives and non-object JSON strings", () => {
    expect(serializeConfig(42)).toBe(INVALID_CONFIG);
    expect(serializeConfig("just text")).toBe(INVALID_CONFIG);
    expect(serializeConfig("[1,2]")).toBe(INVALID_CONFIG);
  });
});
