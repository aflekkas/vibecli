import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type PackageManager = "bun" | "npm";

export type CreateProjectOptions = {
  dir: string;
  name?: string;
  force?: boolean;
  packageManager?: PackageManager;
  vibecliVersion?: string;
  install?: boolean;
};

export type CreatedFile = {
  path: string;
  action: "created" | "overwritten";
};

export type CreateProjectResult = {
  dir: string;
  name: string;
  files: CreatedFile[];
  packageManager: PackageManager;
  vibecliVersion: string;
  installed: boolean;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function packageName(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "vibecli-app";
}

function scripts(packageManager: PackageManager): Record<string, string> {
  return packageManager === "bun"
    ? {
        dev: "bun run src/index.tsx",
        typecheck: "bunx tsc --noEmit",
      }
    : {
        dev: "tsx src/index.tsx",
        typecheck: "tsc --noEmit",
      };
}

function packageJson(name: string, opts: { packageManager: PackageManager; vibecliVersion: string }) {
  const useBun = opts.packageManager === "bun";
  return `${JSON.stringify(
    {
      name,
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: scripts(opts.packageManager),
      dependencies: {
        "@aflekkas/vibecli": opts.vibecliVersion,
        "@ai-sdk/anthropic": "^3.0.71",
        ai: "^6.0.168",
        ink: "^5.0.1",
        react: "^18.3.1",
      },
      devDependencies: {
        "@types/react": "^18.3.12",
        typescript: "^5.7.2",
        ...(useBun ? { "@types/bun": "^1.3.0" } : { tsx: "^4.19.2" }),
      },
    },
    null,
    2,
  )}\n`;
}

function tsconfigJson(packageManager: PackageManager): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        allowImportingTsExtensions: true,
        noEmit: true,
        types: packageManager === "bun" ? ["bun", "react"] : ["react"],
      },
      include: ["src/**/*"],
    },
    null,
    2,
  )}\n`;
}

function appSource(): string {
  return `import React, { useEffect, useRef, useState } from "react";
import { Box, Text, render, useApp } from "ink";
import { anthropic } from "@ai-sdk/anthropic";
import { TextInput } from "@aflekkas/vibecli/text-input";
import { GradientText, createTheme } from "@aflekkas/vibecli/ui";
import { AiSdkProvider } from "@aflekkas/vibecli/providers/adapter";
import { createAgent, type Agent, type AgentEvent } from "@aflekkas/vibecli/agent";

// Swap the model in three lines:
//   1. bun add @ai-sdk/<provider>          (e.g. @ai-sdk/openai)
//   2. import { createX } from "@ai-sdk/<provider>";
//   3. change \`name\`, \`model\`, and \`languageModel\` below.
// Any provider in the Vercel AI SDK ecosystem works.
const MODEL = "claude-sonnet-4-5";
const provider = new AiSdkProvider({
  name: "anthropic",
  model: MODEL,
  languageModel: anthropic(MODEL),
});

// Identity: change this string to give the CLI its own persona, name, voice, rules.
// Swap at runtime with \`agent.setSystem("...")\`.
const SYSTEM_PROMPT = "You are a helpful CLI assistant. Be concise.";

const theme = createTheme({
  colors: { accent: "#38bdf8", placeholder: "#64748b" },
  gradient: { hueStart: 190, hueSpan: 120, saturation: 0.82, lightness: 0.58 },
});

type Turn = { role: "user" | "assistant"; text: string };

function App() {
  const { exit } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const agentRef = useRef<Agent | null>(null);

  useEffect(() => {
    agentRef.current = createAgent(provider, SYSTEM_PROMPT);
  }, []);

  async function send(text: string) {
    const agent = agentRef.current;
    if (!agent) return;
    setTurns((t) => [...t, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    try {
      for await (const ev of agent.send(text) as AsyncGenerator<AgentEvent>) {
        if (ev.type === "text") {
          setTurns((t) => {
            const next = t.slice();
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { role: "assistant", text: last.text + ev.text };
            }
            return next;
          });
        } else if (ev.type === "error") {
          setTurns((t) => [...t, { role: "assistant", text: \`error: \${ev.message}\` }]);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <GradientText text="vibecli" theme={theme} />
      <Text color={theme.colors.muted}>
        Set ANTHROPIC_API_KEY in .env, then chat below. Submit empty to exit.
      </Text>
      {turns.map((t, i) => (
        <Box key={i} flexDirection="column">
          <Text color={t.role === "user" ? theme.colors.accent : undefined}>
            {(t.role === "user" ? "you" : "ai") + "> " + t.text}
          </Text>
        </Box>
      ))}
      <TextInput
        value={input}
        onChange={setInput}
        placeholder={busy ? "thinking..." : "ask anything"}
        theme={theme}
        tabText="  "
        onSubmit={(text) => {
          if (!text.trim()) {
            exit();
            return;
          }
          setInput("");
          void send(text);
        }}
      />
    </Box>
  );
}

render(<App />);
`;
}

function envExample(): string {
  return `ANTHROPIC_API_KEY=\n`;
}

function readme(name: string, packageManager: PackageManager): string {
  const install = packageManager === "bun" ? "bun install" : "npm install";
  const dev = packageManager === "bun" ? "bun run dev" : "npm run dev";
  return `# ${name}

Ink + AI SDK agent CLI scaffolded with vibecli.

## Run

\`\`\`bash
cp .env.example .env  # then paste your ANTHROPIC_API_KEY
${install}
${dev}
\`\`\`

## Identity / system prompt

The CLI's persona lives in one string in \`src/index.tsx\`:

\`\`\`ts
const SYSTEM_PROMPT = "You are a helpful CLI assistant. Be concise.";
\`\`\`

Edit it to give the agent a name, voice, rules, role. Swap at runtime with \`agent.setSystem("new prompt")\`.

## Swap the model

The default is \`claude-sonnet-4-5\` via \`@ai-sdk/anthropic\`. Any Vercel AI SDK provider works. Three lines in \`src/index.tsx\`:

1. Install the provider: \`bun add @ai-sdk/openai\` (or \`@ai-sdk/google\`, \`@ai-sdk/groq\`, etc.)
2. Replace the import: \`import { openai } from "@ai-sdk/openai";\`
3. Update the \`AiSdkProvider\` constructor: change \`name\` to \`"openai"\`, \`MODEL\` to e.g. \`"gpt-4.1"\`, and \`languageModel\` to \`openai(MODEL)\`.

Set the matching API key env var (\`OPENAI_API_KEY\`, \`GOOGLE_GENERATIVE_AI_API_KEY\`, etc.). The AI SDK reads these automatically.

## Add tools

Pass a \`tools\` array to \`createAgent\`:

\`\`\`ts
createAgent(provider, system, {
  tools: [
    {
      def: {
        name: "now",
        description: "Get the current ISO timestamp.",
        input_schema: { type: "object", properties: {} },
      },
      run: async () => new Date().toISOString(),
    },
  ],
});
\`\`\`

The agent loop calls your handlers when the model emits tool calls, and feeds results back automatically.
`;
}

async function writeProjectFile(
  dir: string,
  relativePath: string,
  contents: string,
  force: boolean,
): Promise<CreatedFile> {
  const path = resolve(dir, relativePath);
  const exists = await fileExists(path);
  if (exists && !force) {
    throw new Error(`Refusing to overwrite ${relativePath}. Re-run with --force to replace existing files.`);
  }
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, contents);
  return { path, action: exists ? "overwritten" : "created" };
}

async function readPackageJsonVersion(): Promise<string | null> {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, "..", "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

function runInstall(dir: string, packageManager: PackageManager): Promise<void> {
  return new Promise((resolveFn, rejectFn) => {
    const child = spawn(packageManager, ["install"], { cwd: dir, stdio: "inherit" });
    child.on("error", rejectFn);
    child.on("exit", (code) => {
      if (code === 0) resolveFn();
      else rejectFn(new Error(`${packageManager} install exited with code ${code}`));
    });
  });
}

export async function createProjectSkeleton(opts: CreateProjectOptions): Promise<CreateProjectResult> {
  const dir = resolve(opts.dir);
  const name = packageName(opts.name ?? basename(dir));
  const packageManager = opts.packageManager ?? "bun";
  const detectedVersion = await readPackageJsonVersion();
  const vibecliVersion =
    opts.vibecliVersion ?? (detectedVersion ? `^${detectedVersion}` : "latest");
  const force = opts.force ?? false;
  const install = opts.install ?? true;

  await mkdir(dir, { recursive: true });

  const files = [
    await writeProjectFile(dir, "package.json", packageJson(name, { packageManager, vibecliVersion }), force),
    await writeProjectFile(dir, "tsconfig.json", tsconfigJson(packageManager), force),
    await writeProjectFile(dir, "src/index.tsx", appSource(), force),
    await writeProjectFile(dir, ".env.example", envExample(), force),
    await writeProjectFile(dir, "README.md", readme(name, packageManager), force),
    await writeProjectFile(dir, ".gitignore", "node_modules\n.DS_Store\n.env\n", force),
  ];

  let installed = false;
  if (install) {
    await runInstall(dir, packageManager);
    installed = true;
  }

  return { dir, name, files, packageManager, vibecliVersion, installed };
}
