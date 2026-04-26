#!/usr/bin/env bun

import { createProjectSkeleton, type PackageManager } from "./create-project.ts";

type CliOptions = {
  dir: string;
  name?: string;
  force: boolean;
  packageManager: PackageManager;
  vibecliVersion?: string;
};

function help(): string {
  return `vibecli

Usage:
  vibecli init [dir] [--name <name>] [--pm bun|npm] [--vibecli <version>] [--force]

Examples:
  vibecli init my-cli
  vibecli init . --name my-cli --pm bun
`;
}

function parseArgs(argv: string[]): CliOptions | "help" {
  const [command, ...args] = argv;
  if (!command || command === "--help" || command === "-h") return "help";
  if (command !== "init") throw new Error(`Unknown command: ${command}`);

  const opts: CliOptions = {
    dir: "vibecli-app",
    force: false,
    packageManager: "bun",
  };

  let dirSet = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--help" || arg === "-h") return "help";
    if (arg === "--force") {
      opts.force = true;
      continue;
    }
    if (arg === "--name") {
      opts.name = args[++i];
      if (!opts.name) throw new Error("--name requires a value");
      continue;
    }
    if (arg === "--pm" || arg === "--package-manager") {
      const packageManager = args[++i];
      if (packageManager !== "bun" && packageManager !== "npm") {
        throw new Error("--pm must be either bun or npm");
      }
      opts.packageManager = packageManager;
      continue;
    }
    if (arg === "--vibecli") {
      opts.vibecliVersion = args[++i];
      if (!opts.vibecliVersion) throw new Error("--vibecli requires a version");
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (dirSet) throw new Error(`Unexpected argument: ${arg}`);
    opts.dir = arg;
    dirSet = true;
  }

  return opts;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === "help") {
    process.stdout.write(help());
    return;
  }

  const result = await createProjectSkeleton({
    dir: parsed.dir,
    name: parsed.name,
    force: parsed.force,
    packageManager: parsed.packageManager,
    vibecliVersion: parsed.vibecliVersion,
  });

  process.stdout.write(`Created ${result.name} in ${result.dir}\n`);
  for (const file of result.files) {
    process.stdout.write(`  ${file.action} ${file.path}\n`);
  }
  const install = result.packageManager === "bun" ? "bun install" : "npm install";
  const dev = result.packageManager === "bun" ? "bun run dev" : "npm run dev";
  process.stdout.write(`\nNext:\n  cd ${result.dir}\n  ${install}\n  ${dev}\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`vibecli: ${message}\n\n${help()}`);
  process.exitCode = 1;
});
