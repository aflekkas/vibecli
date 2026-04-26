// Generic scripted-scenario runner over an Agent. Drives a sequence of user
// inputs, asserts on assistant text, returns a structured result. No process
// exits, no provider/system assumptions — the caller owns the agent and
// decides what to do with the result.

import { readFile } from "node:fs/promises";
import type { Agent } from "./agent.ts";

export type ScenarioStep = {
  input: string;
  expectContains?: string;
  expectMatches?: RegExp;
};

export type ScenarioFailure = {
  step: number;
  input: string;
  reason: string;
};

export type ScenarioResult = {
  passed: number;
  failed: number;
  total: number;
  failures: ScenarioFailure[];
};

export type RunScenarioOptions = {
  writer?: NodeJS.WritableStream;
  onStep?: (index: number, step: ScenarioStep) => void;
  onResult?: (index: number, result: { assistantText: string; ok: boolean; reason?: string }) => void;
};

export async function runScenario(
  agent: Agent,
  steps: ScenarioStep[],
  opts: RunScenarioOptions = {},
): Promise<ScenarioResult> {
  const writer = opts.writer ?? process.stdout;
  let passed = 0;
  let failed = 0;
  const failures: ScenarioFailure[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    opts.onStep?.(i, step);
    writer.write(`[${i + 1}/${steps.length}] you> ${step.input}\n`);

    let assistantText = "";
    let streamErrored = false;
    let streamErrorMessage = "";

    for await (const ev of agent.send(step.input)) {
      if (ev.type === "text") {
        assistantText += ev.text;
        writer.write(ev.text);
      } else if (ev.type === "error") {
        streamErrored = true;
        streamErrorMessage = ev.message;
        writer.write(`\n[error] ${ev.message}\n`);
      }
    }
    writer.write("\n");

    if (streamErrored) {
      failed++;
      const reason = `agent error: ${streamErrorMessage}`;
      failures.push({ step: i + 1, input: step.input, reason });
      opts.onResult?.(i, { assistantText, ok: false, reason });
      continue;
    }

    let stepOk = true;
    let stepReason: string | undefined;

    if (step.expectContains) {
      const ok = assistantText.toLowerCase().includes(step.expectContains.toLowerCase());
      writer.write(
        ok
          ? `[pass] expectContains: ${step.expectContains}\n`
          : `[fail] expectContains: ${step.expectContains} (got: ${assistantText.slice(0, 120)}...)\n`,
      );
      if (!ok) {
        stepOk = false;
        stepReason = `expectContains "${step.expectContains}" not found`;
      }
    }

    if (stepOk && step.expectMatches) {
      const ok = step.expectMatches.test(assistantText);
      writer.write(
        ok
          ? `[pass] expectMatches: ${step.expectMatches}\n`
          : `[fail] expectMatches: ${step.expectMatches} (got: ${assistantText.slice(0, 120)}...)\n`,
      );
      if (!ok) {
        stepOk = false;
        stepReason = `expectMatches ${step.expectMatches} did not match`;
      }
    }

    if (stepOk) {
      passed++;
      opts.onResult?.(i, { assistantText, ok: true });
    } else {
      failed++;
      failures.push({ step: i + 1, input: step.input, reason: stepReason ?? "unknown failure" });
      opts.onResult?.(i, { assistantText, ok: false, reason: stepReason });
    }
  }

  const summary =
    failed > 0
      ? `\nscenario failed: ${failed} issue(s)\n`
      : `\nscenario passed: ${steps.length} step(s)\n`;
  writer.write(summary);

  return { passed, failed, total: steps.length, failures };
}

/**
 * Reads a JSON file containing a `ScenarioStep[]` and runs it through `runScenario`.
 * Caller owns the agent and decides what to do with the result (e.g. `process.exit`
 * on failure). Useful as a one-liner for `--script <path>`-style CLI bootstraps.
 */
export async function runScenarioFile(
  path: string,
  agent: Agent,
  opts: RunScenarioOptions = {},
): Promise<ScenarioResult> {
  const raw = await readFile(path, "utf8");
  const steps = JSON.parse(raw) as ScenarioStep[];
  return runScenario(agent, steps, opts);
}
