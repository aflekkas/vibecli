import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export type PackageManager = "bun" | "npm";

export type CreateProjectOptions = {
  dir: string;
  name?: string;
  force?: boolean;
  packageManager?: PackageManager;
  vibecliVersion?: string;
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

function packageJson(name: string, opts: Required<Pick<CreateProjectOptions, "packageManager" | "vibecliVersion">>) {
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
  return `import React, { useState } from "react";
import { Box, Text, render, useApp } from "ink";
import { TextInput } from "@aflekkas/vibecli/text-input";
import { GradientText, createTheme } from "@aflekkas/vibecli/ui";

const theme = createTheme({
  colors: {
    accent: "#38bdf8",
    placeholder: "#64748b",
  },
  gradient: {
    hueStart: 190,
    hueSpan: 120,
    saturation: 0.82,
    lightness: 0.58,
  },
});

function App() {
  const { exit } = useApp();
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <Box flexDirection="column" gap={1}>
      <GradientText text="vibecli" theme={theme} />
      <Text color={theme.colors.muted}>Type a prompt. Submit an empty prompt to exit.</Text>
      <TextInput
        value={value}
        onChange={setValue}
        placeholder="ask anything"
        theme={theme}
        tabText="  "
        onSubmit={(text) => {
          if (!text.trim()) {
            exit();
            return;
          }
          setSubmitted(text);
          setValue("");
        }}
      />
      {submitted ? <Text color={theme.colors.accent}>Last prompt: {submitted}</Text> : null}
    </Box>
  );
}

render(<App />);
`;
}

function readme(name: string, packageManager: PackageManager): string {
  const install = packageManager === "bun" ? "bun install" : "npm install";
  const dev = packageManager === "bun" ? "bun run dev" : "npm run dev";
  return `# ${name}

Ink app scaffolded with vibecli.

\`\`\`bash
${install}
${dev}
\`\`\`

Theme colors live in \`src/index.tsx\`. The app uses vibecli subpath imports so it only pulls the UI primitives it needs.
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

export async function createProjectSkeleton(opts: CreateProjectOptions): Promise<CreateProjectResult> {
  const dir = resolve(opts.dir);
  const name = packageName(opts.name ?? basename(dir));
  const packageManager = opts.packageManager ?? "bun";
  const vibecliVersion = opts.vibecliVersion ?? "latest";
  const force = opts.force ?? false;

  await mkdir(dir, { recursive: true });

  const files = [
    await writeProjectFile(dir, "package.json", packageJson(name, { packageManager, vibecliVersion }), force),
    await writeProjectFile(dir, "tsconfig.json", tsconfigJson(packageManager), force),
    await writeProjectFile(dir, "src/index.tsx", appSource(), force),
    await writeProjectFile(dir, "README.md", readme(name, packageManager), force),
    await writeProjectFile(dir, ".gitignore", "node_modules\n.DS_Store\n.env\n", force),
  ];

  return { dir, name, files, packageManager };
}
