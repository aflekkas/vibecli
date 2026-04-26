import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type LoadDirEntry = {
  dir: string;
  source: string;
};

export type LoadEntryContext = {
  name: string;
  path: string;
  source: string;
};

export type LoadMarkdownDirOptions<T extends { name: string }> = {
  dirs: LoadDirEntry[];
  parseEntry: (raw: string, ctx: LoadEntryContext) => T | null;
  reserved?: ReadonlySet<string>;
  extension?: string;
  mode?: "file" | "dir";
  dirEntrypoint?: string;
  onWarn?: (message: string) => void;
};

function defaultWarn(message: string): void {
  process.stderr.write(`${message}\n`);
}

function deriveName(raw: string, mode: "file" | "dir", extension: string): string {
  if (mode === "dir") return raw.toLowerCase();
  if (raw.endsWith(extension)) return raw.slice(0, -extension.length).toLowerCase();
  return raw.toLowerCase();
}

function readEntries(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function entryPath(dir: string, entry: string, mode: "file" | "dir", dirEntrypoint: string): string | null {
  const path = join(dir, entry);
  if (mode === "file") return path;
  let st;
  try {
    st = statSync(path);
  } catch {
    return null;
  }
  if (!st.isDirectory()) return null;
  const file = join(path, dirEntrypoint);
  if (!existsSync(file)) return null;
  return file;
}

/**
 * Walks one or more directories of `.md` files (or subdirs with an entrypoint),
 * parses each entry with the caller-supplied `parseEntry`, and returns a
 * deduplicated, alphabetically-sorted list.
 *
 * Later dirs in `opts.dirs` override earlier ones for the same name.
 * Names matching `reserved` are skipped with a warning.
 */
export function loadMarkdownDir<T extends { name: string }>(
  opts: LoadMarkdownDirOptions<T>,
): T[] {
  const extension = opts.extension ?? ".md";
  const mode = opts.mode ?? "file";
  const dirEntrypoint = opts.dirEntrypoint ?? "SKILL.md";
  const reserved = opts.reserved ?? new Set<string>();
  const warn = opts.onWarn ?? defaultWarn;

  const byName = new Map<string, T>();
  for (const { dir, source } of opts.dirs) {
    if (!existsSync(dir)) continue;
    const entries = readEntries(dir);
    for (const entry of entries) {
      if (mode === "file" && !entry.endsWith(extension)) continue;
      const path = entryPath(dir, entry, mode, dirEntrypoint);
      if (!path) continue;
      const raw = readText(path);
      if (raw === null) continue;
      const fallbackName = deriveName(entry, mode, extension);
      const parsed = opts.parseEntry(raw, { name: fallbackName, path, source });
      if (!parsed) continue;
      const name = parsed.name.toLowerCase();
      if (reserved.has(name)) {
        warn(`vibecli: skipping '${name}' from ${path} (reserved name)`);
        continue;
      }
      byName.set(name, { ...parsed, name });
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
