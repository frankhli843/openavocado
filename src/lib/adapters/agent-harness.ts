import { spawn } from "node:child_process";
import type {
  CompletionHookAdapter,
  LessonCompletedEvent,
  LessonDiscardedEvent,
  RegenerationHookAdapter,
  SubjectCreatedEvent,
} from "@/types";

type AdapterEvent = LessonCompletedEvent | LessonDiscardedEvent | SubjectCreatedEvent;

type HarnessResult = {
  ok: boolean;
  ref?: string;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export const agentHarnessAdapter: CompletionHookAdapter = {
  name: "agent-harness",
  dispatch(event, config) {
    return runAgentHarness("lesson.completed", event, config);
  },
};

export const agentHarnessRegenerationAdapter: RegenerationHookAdapter = {
  name: "agent-harness",
  dispatch(event, config) {
    return runAgentHarness("lesson.discarded", event, config);
  },
};

export function agentHarnessSubjectCreatedDispatcher(
  event: SubjectCreatedEvent,
  config?: Record<string, unknown>
): Promise<HarnessResult> {
  return runAgentHarness("subject.created", event, config);
}

function commandFrom(config?: Record<string, unknown>): string | undefined {
  const configured = config?.command;
  return typeof configured === "string" && configured.trim()
    ? configured.trim()
    : process.env.AVOCADOCORE_AGENT_HARNESS_COMMAND?.trim();
}

function timeoutFrom(config?: Record<string, unknown>): number {
  const configured = config?.timeout_ms;
  const raw = typeof configured === "number" ? configured : Number(process.env.AVOCADOCORE_AGENT_HARNESS_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

function runAgentHarness(
  kind: AdapterEvent["event"],
  event: AdapterEvent,
  config?: Record<string, unknown>
): Promise<HarnessResult> {
  const command = commandFrom(config);
  if (!command) {
    return Promise.resolve({
      ok: false,
      error: "agent-harness adapter: no command configured (AVOCADOCORE_AGENT_HARNESS_COMMAND or config.command)",
    });
  }

  const timeoutMs = timeoutFrom(config);
  const payload = JSON.stringify({ event_kind: kind, event }) + "\n";

  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: HarnessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish({ ok: false, error: `agent-harness adapter timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (err) => finish({ ok: false, error: err.message }));
    child.on("close", (code) => {
      if (code === 0) {
        finish({ ok: true, ref: parseHarnessRef(stdout) ?? `agent-harness-${kind}-${Date.now()}` });
      } else {
        finish({ ok: false, error: stderr.trim() || stdout.trim() || `agent-harness command exited ${code}` });
      }
    });

    child.stdin.end(payload);
  });
}

function parseHarnessRef(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as { ref?: unknown; id?: unknown };
    const ref = parsed.ref ?? parsed.id;
    return typeof ref === "string" && ref ? ref : undefined;
  } catch {
    return trimmed.split(/\r?\n/, 1)[0].slice(0, 120);
  }
}
