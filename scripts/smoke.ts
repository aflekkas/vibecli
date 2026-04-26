#!/usr/bin/env bun
/**
 * Post-publish smoke test:
 *  1. mkdtemp
 *  2. scaffold playground from just-published vibecli into the tmpdir
 *  3. bun install (real npm pull)
 *  4. for each templates/playground/scenarios/*.json, run scaffolded app with
 *     --script and assert pass
 *  5. cleanup
 *
 * Run via `bun run smoke` (or automatically as part of `bun run ship`).
 *
 * Requires OPENAI_API_KEY in env.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SCENARIOS_DIR = resolve(REPO, "templates", "playground", "scenarios");

type SpawnResult = { code: number | null; stdout: string; stderr: string };

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<SpawnResult> {
  return new Promise((resolveFn) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? process.cwd(),
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolveFn({ code, stdout, stderr }));
  });
}

async function readPackageVersion(): Promise<string> {
  const raw = await Bun.file(resolve(REPO, "package.json")).text();
  const parsed = JSON.parse(raw) as { version: string };
  return parsed.version;
}

async function listScenarios(): Promise<string[]> {
  try {
    const entries = await readdir(SCENARIOS_DIR);
    return entries.filter((f) => f.endsWith(".json")).map((f) => join(SCENARIOS_DIR, f));
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    process.stderr.write("smoke: OPENAI_API_KEY missing — skipping (export it to enable)\n");
    process.exit(0);
  }

  const version = await readPackageVersion();
  const scenarios = await listScenarios();
  if (scenarios.length === 0) {
    process.stderr.write("smoke: no scenarios in templates/playground/scenarios/\n");
    process.exit(0);
  }

  const tmp = await mkdtemp(join(tmpdir(), "vibecli-smoke-"));
  process.stdout.write(`smoke: scaffolding into ${tmp} from @aflekkas/vibecli@${version}\n`);

  try {
    const init = await run(
      "bunx",
      [
        `@aflekkas/vibecli@${version}`,
        "init",
        tmp,
        "--template",
        "playground",
        "--no-prompt",
        "--no-install",
        "--force",
      ],
    );
    if (init.code !== 0) {
      process.stderr.write(`smoke: init failed\n${init.stdout}\n${init.stderr}\n`);
      process.exit(1);
    }

    const install = await run("bun", ["install"], { cwd: tmp });
    if (install.code !== 0) {
      process.stderr.write(`smoke: bun install failed\n${install.stderr}\n`);
      process.exit(1);
    }

    let failed = 0;
    for (const scenario of scenarios) {
      process.stdout.write(`smoke: running scenario ${scenario}\n`);
      const r = await run("bun", ["run", "src/index.tsx", "--script", scenario], { cwd: tmp });
      process.stdout.write(r.stdout);
      if (r.code !== 0) {
        process.stderr.write(`smoke: scenario failed (exit ${r.code})\n${r.stderr}\n`);
        failed++;
      }
    }

    if (failed > 0) {
      process.stderr.write(`smoke: ${failed} scenario(s) failed\n`);
      process.exit(1);
    }
    process.stdout.write(`smoke: ${scenarios.length} scenario(s) passed\n`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

await main();
