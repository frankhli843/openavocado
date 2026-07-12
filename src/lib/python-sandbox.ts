/**
 * Browser Python sandbox adapter boundary.
 *
 * This module defines the typed interface for browser-based Python execution
 * via Pyodide/WebAssembly. The actual Pyodide loading happens in a browser
 * component (PythonRunner). Server-side execution is out of scope for the
 * portable baseline.
 *
 * To swap in a server-side executor later, implement the PythonExecutor
 * interface and wire it through the adapter registry.
 */

export interface CodeRunResult {
  stdout: string;
  stderr: string;
  error: string | null;
  test_results: TestResult[];
  run_at: string;
  duration_ms: number;
}

export interface TestResult {
  id: string;
  description: string;
  passed: boolean;
  error: string | null;
}

export interface CodeRunRequest {
  code: string;
  tests?: Array<{
    id: string;
    description: string;
    assert: string; // Python expression to evaluate
  }>;
  timeout_ms?: number;
}

/**
 * Adapter interface for Python execution.
 * Browser implementations use Pyodide; server implementations can use
 * a sandboxed subprocess or remote executor.
 */
export interface PythonExecutor {
  name: "pyodide" | "server-side" | "stub";
  isReady(): boolean;
  run(request: CodeRunRequest): Promise<CodeRunResult>;
}

/**
 * Stub executor — returned before Pyodide has loaded.
 * Shows a clear pending state rather than silently failing.
 */
export const stubExecutor: PythonExecutor = {
  name: "stub",
  isReady() {
    return false;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async run(_request: CodeRunRequest): Promise<CodeRunResult> {
    return {
      stdout: "",
      stderr: "",
      error: "Python runtime is not yet loaded. Please wait for Pyodide to initialize.",
      test_results: [],
      run_at: new Date().toISOString(),
      duration_ms: 0,
    };
  },
};

/**
 * Creates a Pyodide-backed executor.
 * Call this from a browser component after `loadPyodide()` resolves.
 *
 * Usage in a React component:
 *   const [executor, setExecutor] = useState<PythonExecutor>(stubExecutor)
 *   useEffect(() => {
 *     loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' })
 *       .then(py => setExecutor(createPyodideExecutor(py)))
 *   }, [])
 */
export function createPyodideExecutor(pyodide: PyodideInterface): PythonExecutor {
  return {
    name: "pyodide",
    isReady() {
      return true;
    },
    async run(request: CodeRunRequest): Promise<CodeRunResult> {
      const startMs = Date.now();
      const run_at = new Date().toISOString();
      let stdout = "";
      let stderr = "";
      let error: string | null = null;
      const testSource = (request.tests ?? []).map((test) => test.assert).join("\n");

      try {
        if (pyodide.loadPackagesFromImports) {
          await pyodide.loadPackagesFromImports([request.code, testSource].filter(Boolean).join("\n"));
        }

        // Capture stdout/stderr
        pyodide.runPython(`
import sys, io
_stdout_capture = io.StringIO()
_stderr_capture = io.StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

        pyodide.runPython(request.code);

        stdout = pyodide.runPython("_stdout_capture.getvalue()") as string;
        stderr = pyodide.runPython("_stderr_capture.getvalue()") as string;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        try {
          stdout = pyodide.runPython("_stdout_capture.getvalue()") as string;
          stderr = pyodide.runPython("_stderr_capture.getvalue()") as string;
        } catch {
          // ignore recovery errors
        }
      } finally {
        // Restore stdout/stderr
        try {
          pyodide.runPython("sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__");
        } catch {
          // ignore
        }
      }

      // Run tests
      const test_results: TestResult[] = [];
      if (request.tests && !error) {
        for (const test of request.tests) {
          try {
            const passed = pyodide.runPython(test.assert) as boolean;
            test_results.push({ id: test.id, description: test.description, passed: Boolean(passed), error: null });
          } catch (e) {
            test_results.push({
              id: test.id,
              description: test.description,
              passed: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }

      return {
        stdout,
        stderr,
        error,
        test_results,
        run_at,
        duration_ms: Date.now() - startMs,
      };
    },
  };
}

// Minimal Pyodide type (avoids hard dependency on @types/pyodide)
interface PyodideInterface {
  runPython(code: string): unknown;
  loadPackagesFromImports?(code: string): Promise<void>;
}
