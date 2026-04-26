import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { themeNames, type ThemeName } from "./themes.ts";

export type PackageManager = "bun" | "npm";

export const builtInTemplates = ["playground"] as const;
export type BuiltInTemplate = (typeof builtInTemplates)[number];
export const defaultTemplate: BuiltInTemplate = "playground";

export function isBuiltInTemplate(value: string): value is BuiltInTemplate {
  return (builtInTemplates as readonly string[]).includes(value);
}

export type CreateProjectOptions = {
  dir: string;
  name?: string;
  force?: boolean;
  packageManager?: PackageManager;
  vibecliVersion?: string;
  install?: boolean;
  theme?: ThemeName;
  template?: BuiltInTemplate;
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
  theme: ThemeName;
  template: BuiltInTemplate;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(HERE, "..", "templates");

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

async function walkTemplate(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push(relative(root, full));
      }
    }
  }
  await walk(root);
  return out;
}

function substitutePlaceholders(
  content: string,
  vars: Record<string, string>,
): string {
  return content.replace(/__([A-Z_]+)__/g, (match, key: string) => {
    return key in vars ? vars[key]! : match;
  });
}

function targetRelativePath(templateRelPath: string): string {
  const base = basename(templateRelPath);
  if (base === "_gitignore") {
    return join(dirname(templateRelPath), ".gitignore");
  }
  return templateRelPath;
}

type ScriptsBlock = Record<string, string>;

function scriptsForPackageManager(packageManager: PackageManager): ScriptsBlock {
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

function adaptPackageJson(
  raw: string,
  packageManager: PackageManager,
): string {
  const parsed = JSON.parse(raw) as {
    scripts?: ScriptsBlock;
    devDependencies?: Record<string, string>;
  };
  parsed.scripts = scriptsForPackageManager(packageManager);
  if (packageManager === "npm") {
    const dev = { ...(parsed.devDependencies ?? {}) };
    delete dev["@types/bun"];
    dev.tsx = dev.tsx ?? "^4.19.2";
    parsed.devDependencies = dev;
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function adaptTsconfig(raw: string, packageManager: PackageManager): string {
  if (packageManager === "bun") return raw;
  const parsed = JSON.parse(raw) as {
    compilerOptions?: { types?: string[] };
  };
  if (parsed.compilerOptions?.types) {
    parsed.compilerOptions.types = parsed.compilerOptions.types.filter(
      (t) => t !== "bun",
    );
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
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
    throw new Error(
      `Refusing to overwrite ${relativePath}. Re-run with --force to replace existing files.`,
    );
  }
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, contents);
  return { path, action: exists ? "overwritten" : "created" };
}

async function readPackageJsonVersion(): Promise<string | null> {
  try {
    const pkgPath = resolve(HERE, "..", "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

function runInstall(
  dir: string,
  packageManager: PackageManager,
): Promise<void> {
  return new Promise((resolveFn, rejectFn) => {
    const child = spawn(packageManager, ["install"], {
      cwd: dir,
      stdio: "inherit",
    });
    child.on("error", rejectFn);
    child.on("exit", (code) => {
      if (code === 0) resolveFn();
      else rejectFn(new Error(`${packageManager} install exited with code ${code}`));
    });
  });
}

export async function createProjectSkeleton(
  opts: CreateProjectOptions,
): Promise<CreateProjectResult> {
  const dir = resolve(opts.dir);
  const name = packageName(opts.name ?? basename(dir));
  const packageManager = opts.packageManager ?? "bun";
  const detectedVersion = await readPackageJsonVersion();
  const vibecliVersion =
    opts.vibecliVersion ?? (detectedVersion ? `^${detectedVersion}` : "latest");
  const force = opts.force ?? false;
  const install = opts.install ?? true;
  const theme: ThemeName = opts.theme ?? themeNames[0]!;
  const template: BuiltInTemplate = opts.template ?? defaultTemplate;

  const templateRoot = resolve(TEMPLATES_DIR, template);
  if (!(await fileExists(templateRoot))) {
    throw new Error(
      `Template "${template}" not found at ${templateRoot}. Available: ${builtInTemplates.join(", ")}.`,
    );
  }

  await mkdir(dir, { recursive: true });

  const placeholders: Record<string, string> = {
    NAME: name,
    VIBECLI_VERSION: vibecliVersion,
    THEME: theme,
    THEME_NAMES: themeNames.join(", "),
  };

  const relPaths = await walkTemplate(templateRoot);
  const files: CreatedFile[] = [];
  for (const rel of relPaths) {
    const abs = join(templateRoot, rel);
    const raw = await readFile(abs, "utf8");
    let content = substitutePlaceholders(raw, placeholders);
    const target = targetRelativePath(rel);
    if (basename(target) === "package.json") {
      content = adaptPackageJson(content, packageManager);
    } else if (basename(target) === "tsconfig.json") {
      content = adaptTsconfig(content, packageManager);
    }
    files.push(await writeProjectFile(dir, target, content, force));
  }

  let installed = false;
  if (install) {
    await runInstall(dir, packageManager);
    installed = true;
  }

  return {
    dir,
    name,
    files,
    packageManager,
    vibecliVersion,
    installed,
    theme,
    template,
  };
}
