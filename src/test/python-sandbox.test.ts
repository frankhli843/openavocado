import { describe, expect, it } from "vitest";
import { createPyodideExecutor } from "@/lib/python-sandbox";

describe("createPyodideExecutor", () => {
  it("loads Pyodide packages required by learner code and tests before execution", async () => {
    const loadedSources: string[] = [];
    const executed: string[] = [];
    const pyodide = {
      async loadPackagesFromImports(source: string) {
        loadedSources.push(source);
      },
      runPython(code: string) {
        executed.push(code);
        if (code === "_stdout_capture.getvalue()") return "";
        if (code === "_stderr_capture.getvalue()") return "";
        if (code === "uses_numpy()") return true;
        return undefined;
      },
    };

    const executor = createPyodideExecutor(pyodide);
    const result = await executor.run({
      code: "import numpy as np\n\ndef uses_numpy():\n    return np.zeros((1,)).shape == (1,)",
      tests: [{ id: "numpy", description: "NumPy import works", assert: "uses_numpy()" }],
    });

    expect(loadedSources).toHaveLength(1);
    expect(loadedSources[0]).toContain("import numpy as np");
    expect(loadedSources[0]).toContain("uses_numpy()");
    expect(executed.some((source) => source.includes("import sys, io"))).toBe(true);
    expect(result.error).toBeNull();
    expect(result.test_results).toEqual([
      { id: "numpy", description: "NumPy import works", passed: true, error: null },
    ]);
  });
});
