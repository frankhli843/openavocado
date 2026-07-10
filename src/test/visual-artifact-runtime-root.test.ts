import { afterEach, describe, expect, it } from "vitest";
import { compiledAssetAbsPath } from "../lib/visual-artifacts/build";

const ORIGINAL = process.env.AVOCADOCORE_RUNTIME_ROOT;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AVOCADOCORE_RUNTIME_ROOT;
  else process.env.AVOCADOCORE_RUNTIME_ROOT = ORIGINAL;
});

describe("visual artifact runtime root", () => {
  it("writes compiled bundles under process.cwd()/runtime_artifacts when AVOCADOCORE_RUNTIME_ROOT is unset", () => {
    delete process.env.AVOCADOCORE_RUNTIME_ROOT;
    expect(compiledAssetAbsPath("demo-artifact", "abc123")).toBe(
      `${process.cwd()}/runtime_artifacts/visual-artifacts/demo-artifact/abc123/bundle.js`
    );
  });

  it("writes compiled bundles under AVOCADOCORE_RUNTIME_ROOT when configured", () => {
    process.env.AVOCADOCORE_RUNTIME_ROOT = "/var/prodavo/runtime_artifacts";
    expect(compiledAssetAbsPath("demo-artifact", "abc123")).toBe(
      "/var/prodavo/runtime_artifacts/visual-artifacts/demo-artifact/abc123/bundle.js"
    );
  });
});
