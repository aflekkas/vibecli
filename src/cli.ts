#!/usr/bin/env bun

import { createInterface } from "node:readline/promises";
import {
  builtInTemplates,
  createProjectSkeleton,
  defaultTemplate,
  isBuiltInTemplate,
  type BuiltInTemplate,
  type PackageManager,
} from "./create-project.ts";
import { isThemeName, themeNames, type ThemeName } from "./ui/themes.ts";

type CliOptions = {
  dir: string;
  name?: string;
  force: boolean;
  packageManager: PackageManager;
  vibecliVersion?: string;
  install: boolean;
  theme?: ThemeName;
  template?: BuiltInTemplate;
  noPrompt: boolean;
};

function help(): string {
  return `vibecli

Usage:
  vibecli init [dir] [--template <name>] [--name <name>] [--pm bun|npm] [--vibecli <version>] [--theme <name>] [--no-prompt] [--no-install] [--force]
  vibecli mcp

Templates:
  ${builtInTemplates.join(", ")} (default: ${defaultTemplate})

Themes:
  ${themeNames.join(", ")}

Examples:
  vibecli init my-cli
  vibecli init . --name my-cli --pm bun
  vibecli init my-cli --theme ocean --no-prompt
  vibecli init my-cli --template playground
  vibecli mcp                     # local stdio MCP server exposing this package's docs
`;
}

function parseArgs(argv: string[]): CliOptions | "help" | "mcp" {
  const [command, ...args] = argv;
  if (!command || command === "--help" || command === "-h") return "help";
  if (command === "mcp") {
    if (args.length > 0) throw new Error(`Unexpected argument: ${args[0]}`);
    return "mcp";
  }
  if (command !== "init") throw new Error(`Unknown command: ${command}`);

  const opts: CliOptions = {
    dir: "vibecli-app",
    force: false,
    packageManager: "bun",
    install: true,
    noPrompt: false,
  };

  let dirSet = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--help" || arg === "-h") return "help";
    if (arg === "--force") {
      opts.force = true;
      continue;
    }
    if (arg === "--no-install") {
      opts.install = false;
      continue;
    }
    if (arg === "--no-prompt") {
      opts.noPrompt = true;
      continue;
    }
    if (arg === "--theme") {
      const theme = args[++i];
      if (!theme) throw new Error("--theme requires a value");
      if (!isThemeName(theme)) {
        throw new Error(`--theme must be one of: ${themeNames.join(", ")}`);
      }
      opts.theme = theme;
      continue;
    }
    if (arg === "--template") {
      const template = args[++i];
      if (!template) throw new Error("--template requires a value");
      if (!isBuiltInTemplate(template)) {
        throw new Error(
          `--template must be one of: ${builtInTemplates.join(", ")}`,
        );
      }
      opts.template = template;
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

async function promptTheme(): Promise<ThemeName> {
  const defaultName = themeNames[0]!;
  process.stdout.write("\nPick a theme:\n");
  themeNames.forEach((name, i) => {
    const marker = i === 0 ? " (default)" : "";
    process.stdout.write(`  ${i + 1}. ${name}${marker}\n`);
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`Choose [1-${themeNames.length}] (default 1): `)).trim();
    if (!answer) return defaultName;
    const idx = Number.parseInt(answer, 10);
    if (Number.isFinite(idx) && idx >= 1 && idx <= themeNames.length) {
      return themeNames[idx - 1]!;
    }
    if (isThemeName(answer)) return answer;
    process.stdout.write(`Unrecognized choice "${answer}", using ${defaultName}.\n`);
    return defaultName;
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === "help") {
    process.stdout.write(help());
    return;
  }

  if (parsed === "mcp") {
    const { runDocsMcpServer } = await import("./mcp-server.ts");
    await runDocsMcpServer();
    return;
  }

  let theme = parsed.theme;
  if (!theme && !parsed.noPrompt && process.stdin.isTTY) {
    theme = await promptTheme();
  }

  const result = await createProjectSkeleton({
    dir: parsed.dir,
    name: parsed.name,
    force: parsed.force,
    packageManager: parsed.packageManager,
    vibecliVersion: parsed.vibecliVersion,
    install: parsed.install,
    theme,
    template: parsed.template,
  });

  process.stdout.write(`Created ${result.name} in ${result.dir}\n`);
  process.stdout.write(`  template: ${result.template}\n`);
  process.stdout.write(`  theme: ${result.theme}\n`);
  for (const file of result.files) {
    process.stdout.write(`  ${file.action} ${file.path}\n`);
  }
  const dev = result.packageManager === "bun" ? "bun run dev" : "npm run dev";
  process.stdout.write(`\nNext:\n  cd ${result.dir}\n  cp .env.example .env  # paste your provider API key(s)\n  ${dev}\n  (type \`/model\` to switch models, \`/theme\` to switch themes)\n`);
  if (!result.installed) {
    const install = result.packageManager === "bun" ? "bun install" : "npm install";
    process.stdout.write(`  (run \`${install}\` first — skipped via --no-install)\n`);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`vibecli: ${message}\n\n${help()}`);
  process.exitCode = 1;
});
