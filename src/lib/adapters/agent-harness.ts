import { spawn } from "node:child_process";
import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  LessonDiscardedEvent,
  RegenerationHookAdapter,
  SubjectCreatedDispatcher,
  SubjectCreatedEvent,
} from "@/types";
import { summarizeAiStudioConfig } from "@/lib/providers/google-ai-studio";

type HarnessEvent = LessonCompletedEvent | LessonDiscardedEvent | SubjectCreatedEvent;

interface HarnessCommandResult {
  ok: boolean;
  ref?: string;
  lesson_id?: number;
  error?: string;
}

export const agentHarnessAdapter: CompletionHookAdapter = {
  name: "agent-harness",
  async dispatch(event: LessonCompletedEvent) {
    return dispatchToAgentHarness(event);
  },
};

export const agentHarnessRegenerationAdapter: RegenerationHookAdapter = {
  name: "agent-harness",
  async dispatch(event: LessonDiscardedEvent) {
    return dispatchToAgentHarness(event);
  },
};

export const agentHarnessSubjectCreatedDispatcher: SubjectCreatedDispatcher = async (event) => {
  return dispatchToAgentHarness(event);
};

async function dispatchToAgentHarness(event: HarnessEvent): Promise<HarnessCommandResult> {
  const command = process.env.AVOCADOCORE_AGENT_HARNESS_COMMAND?.trim();
  if (!command) {
    return {
      ok: false,
      error:
        "AVOCADOCORE_COMPLETION_ADAPTER=agent-harness requires AVOCADOCORE_AGENT_HARNESS_COMMAND. Refusing to fall back to local-queue silently.",
    };
  }

  const provider = process.env.AVOCADOCORE_DEFAULT_PROVIDER || "unset";
  const providerStatus = provider === "google-ai-studio" ? summarizeAiStudioConfig() : null;
  const payload = {
    event_type: event.event,
    event,
    provider,
    provider_status: providerStatus,
    contract: {
      expected_output:
        "JSON object with { ok: boolean, ref?: string, lesson_id?: number, error?: string }. The harness must create/validate lessons itself and never print secrets.",
      chrome_mcp_required: true,
      local_queue_fallback_allowed: false,
      lesson_buffer_policy:
        event.event === "lesson.completed"
          ? "Maintain two queued ready lessons. Enrich existing queued lessons from the completed lesson before generating missing lessons."
          : undefined,
      one_off_policy:
        event.event === "subject.created" && event.lesson_type === "one_off"
          ? "Generate exactly one pure teaching lesson from the subject context and source materials. Do not create a separate initial assessment lesson."
          : undefined,
    },
  };

  return runHarnessCommand(command, payload);
}

async function runHarnessCommand(command: string, payload: unknown): Promise<HarnessCommandResult> {
  const timeoutMs = Number(process.env.AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS || 900_000);
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        ok: false,
        error: `Agent harness timed out after ${Math.round(timeoutMs / 1000)}s`,
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `Agent harness failed to start: ${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          error: `Agent harness exited ${code}: ${sanitizeHarnessText(stderr || stdout)}`,
        });
        return;
      }
      const parsed = parseHarnessResult(stdout);
      resolve(parsed);
    });

    child.stdin.on("error", () => {
      // Ignore EPIPE: child may exit before reading stdin (e.g. `exit 1`).
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function parseHarnessResult(stdout: string): HarnessCommandResult {
  const text = stdout.trim();
  if (!text) return { ok: false, error: "Agent harness produced no JSON result" };
  const candidate = text
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().startsWith("{"));
  if (!candidate) {
    return { ok: false, error: `Agent harness output did not contain JSON: ${sanitizeHarnessText(text)}` };
  }
  try {
    const parsed = JSON.parse(candidate) as HarnessCommandResult;
    if (typeof parsed.ok !== "boolean") {
      return { ok: false, error: "Agent harness JSON result is missing boolean ok" };
    }
    return {
      ok: parsed.ok,
      ref: typeof parsed.ref === "string" ? parsed.ref : undefined,
      lesson_id: typeof parsed.lesson_id === "number" ? parsed.lesson_id : undefined,
      error: typeof parsed.error === "string" ? sanitizeHarnessText(parsed.error) : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Agent harness JSON parse failed: ${msg}` };
  }
}

function sanitizeHarnessText(value: string): string {
  const key = process.env.GOOGLE_AI_STUDIO_API_KEY?.trim();
  let text = value.replace(/\s+/g, " ").trim().slice(0, 500);
  if (key) text = text.split(key).join("[redacted]");
  return text || "No output";
}
