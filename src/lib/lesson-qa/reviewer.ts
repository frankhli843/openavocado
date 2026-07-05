/**
 * ACP reviewer invocation.
 *
 * Per AGENTS.md, the semantic reviewer is an ACP agent — NOT a direct model API
 * call from this process. We therefore spawn an env-configured command (the ACP
 * Claude worker wrapper), hand it the review payload on stdin as JSON, and read
 * the verdict as the last `{`-prefixed line on stdout. This mirrors the existing
 * agent-harness dispatch contract (src/lib/adapters/agent-harness.ts).
 *
 * Configure the reviewer command via AVOCADOCORE_QA_REVIEWER_COMMAND, e.g. a
 * wrapper that pipes the prompt to a headless Claude/openclaw ACP worker. In
 * tests, point it at a small script that emits a canned verdict.
 */

import { spawn } from "node:child_process";
import type { GatheredLesson } from "./gather";
import { buildReviewPrompt } from "./prompt";
import { parseVerdict, type QaVerdict } from "./verdict";

export interface ReviewerPayload {
  lesson_id: number;
  attempt: number;
  /** The fully-rendered reviewer prompt (all four dimensions + content). */
  prompt: string;
  /** The structured gathered content, so an agent can inspect fields directly. */
  gathered: GatheredLesson;
}

export interface InvokeReviewerOptions {
  /** Override the reviewer command (defaults to AVOCADOCORE_QA_REVIEWER_COMMAND). */
  command?: string;
  /** Attempt number, forwarded to the reviewer payload. */
  attempt?: number;
  /** Timeout in ms (defaults to AVOCADOCORE_QA_REVIEWER_TIMEOUT_MS or 900000). */
  timeoutMs?: number;
}

export interface ReviewerRunResult {
  verdict: QaVerdict;
  /** Raw stdout for audit/debug. */
  rawOutput: string;
}

function resolveCommand(opts: InvokeReviewerOptions): string {
  const command = (opts.command ?? process.env.AVOCADOCORE_QA_REVIEWER_COMMAND ?? "").trim();
  if (!command) {
    throw new Error(
      "AVOCADOCORE_QA_REVIEWER_COMMAND is not set. The semantic QA reviewer must run as an ACP agent command; refusing to fall back to a direct model API call."
    );
  }
  return command;
}

/**
 * Invoke the ACP reviewer command with the gathered lesson and return its parsed
 * verdict. Throws on spawn failure, timeout, non-zero exit, or malformed verdict.
 */
export async function invokeReviewer(
  lesson: GatheredLesson,
  opts: InvokeReviewerOptions = {}
): Promise<ReviewerRunResult> {
  const command = resolveCommand(opts);
  const attempt = opts.attempt ?? 1;
  const timeoutMs = opts.timeoutMs ?? Number(process.env.AVOCADOCORE_QA_REVIEWER_TIMEOUT_MS || 900_000);

  const payload: ReviewerPayload = {
    lesson_id: lesson.lessonId,
    attempt,
    prompt: buildReviewPrompt(lesson),
    gathered: lesson,
  };

  const stdout = await runReviewerCommand(command, payload, timeoutMs);
  const verdict = parseVerdict(stdout);
  return { verdict, rawOutput: stdout };
}

function runReviewerCommand(command: string, payload: ReviewerPayload, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`QA reviewer timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`QA reviewer failed to start: ${err.message}`));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`QA reviewer exited ${code}: ${stderr.slice(0, 400) || stdout.slice(0, 400)}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.on("error", () => {
      // Ignore EPIPE: the child may exit before reading stdin.
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
