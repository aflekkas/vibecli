import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";

export type RepoFileKind = "source" | "test" | "config" | "docs" | "asset" | "other";

export type RepoMapFile = {
  path: string;
  size: number;
  language: string | null;
  kind: RepoFileKind;
};

export type RepoMap = {
  root: string;
  files: RepoMapFile[];
  languages: Record<string, number>;
  kinds: Record<RepoFileKind, number>;
  totalSize: number;
  truncated: boolean;
};

export type RepoMapOptions = {
  maxFiles?: number;
  maxDepth?: number;
  ignoreDirs?: string[];
  includeExtensions?: string[];
};

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".cache",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  ".c": "C",
  ".cc": "C++",
  ".cpp": "C++",
  ".css": "CSS",
  ".go": "Go",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".jsx": "JavaScript React",
  ".json": "JSON",
  ".lua": "Lua",
  ".md": "Markdown",
  ".mjs": "JavaScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".rs": "Rust",
  ".sh": "Shell",
  ".sql": "SQL",
  ".swift": "Swift",
  ".toml": "TOML",
  ".ts": "TypeScript",
  ".tsx": "TypeScript React",
  ".yaml": "YAML",
  ".yml": "YAML",
};

const ASSET_EXTS = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".svg",
  ".webp",
  ".woff",
  ".woff2",
]);

/**
 * BFS-ordered file walk from `root`, capped by `maxFiles` and `maxDepth`.
 * Sets `truncated: true` if the file cap was hit mid-walk.
 * Returns per-file language + kind metadata and aggregate language/kind counts.
 */
export async function buildRepoMap(root: string, opts: RepoMapOptions = {}): Promise<RepoMap> {
  const maxFiles = opts.maxFiles ?? 500;
  const maxDepth = opts.maxDepth ?? 8;
  const ignoreDirs = new Set([...DEFAULT_IGNORE_DIRS, ...(opts.ignoreDirs ?? [])]);
  const includeExtensions = opts.includeExtensions
    ? new Set(opts.includeExtensions.map((ext) => ext.toLowerCase()))
    : null;
  const files: RepoMapFile[] = [];
  let truncated = false;

  async function visit(dir: string, depth: number): Promise<void> {
    if (truncated || depth > maxDepth) return;
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (truncated) return;
      const absolutePath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) await visit(absolutePath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;

      const relPath = relative(root, absolutePath).split(sep).join("/");
      const ext = extname(entry.name).toLowerCase();
      if (includeExtensions && !includeExtensions.has(ext)) continue;

      const fileStat = await stat(absolutePath);
      files.push({
        path: relPath,
        size: fileStat.size,
        language: languageForPath(relPath),
        kind: classifyRepoFile(relPath),
      });

      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }
    }
  }

  await visit(root, 0);

  const kinds: Record<RepoFileKind, number> = {
    source: 0,
    test: 0,
    config: 0,
    docs: 0,
    asset: 0,
    other: 0,
  };
  const languages: Record<string, number> = {};
  let totalSize = 0;

  for (const file of files) {
    kinds[file.kind]++;
    totalSize += file.size;
    if (file.language) languages[file.language] = (languages[file.language] ?? 0) + 1;
  }

  return { root, files, languages, kinds, totalSize, truncated };
}

export function languageForPath(path: string): string | null {
  return LANGUAGE_BY_EXT[extname(path).toLowerCase()] ?? null;
}

/**
 * Classifies a file path into a `RepoFileKind` using heuristic precedence:
 * asset > docs > test > config > source (has known language) > other.
 */
export function classifyRepoFile(path: string): RepoFileKind {
  const name = basename(path).toLowerCase();
  const ext = extname(name);
  if (ASSET_EXTS.has(ext)) return "asset";
  if (name === "readme.md" || name.endsWith(".md") || path.toLowerCase().startsWith("docs/")) return "docs";
  if (
    name.includes(".test.") ||
    name.includes(".spec.") ||
    path.includes("/test/") ||
    path.includes("/tests/") ||
    path.includes("__tests__/")
  ) {
    return "test";
  }
  if (
    name.startsWith(".") ||
    name.endsWith("config.js") ||
    name.endsWith("config.ts") ||
    name === "package.json" ||
    name === "tsconfig.json"
  ) {
    return "config";
  }
  return languageForPath(path) ? "source" : "other";
}

export function summarizeRepoMap(map: RepoMap): string {
  const languageSummary = Object.entries(map.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => `${language}: ${count}`)
    .join(", ");
  const kindSummary = Object.entries(map.kinds)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind}: ${count}`)
    .join(", ");
  const suffix = map.truncated ? " (truncated)" : "";
  return `${map.files.length} files${suffix}; ${kindSummary}; ${languageSummary}`;
}
