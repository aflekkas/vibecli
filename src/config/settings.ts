// Generic settings-hierarchy loader. Reads multiple JSON files in order and
// deep-merges them. Caller supplies the file paths and optional scope labels;
// nothing in this module knows about specific filenames or consumer conventions.

import { readFileSync } from "node:fs";

export type SettingsSource = {
  /** Absolute or relative file path. May not exist; that's fine. */
  path: string;
  /** Caller-supplied label, e.g. "managed", "user", "project", "local". Free-form string. */
  scope?: string;
};

export type SettingsLoadResult = {
  /** Deep-merged config. Later sources win for scalars. Arrays follow arrayPolicy. */
  merged: Record<string, unknown>;
  /** Each source actually read, in order. Includes parsed value and any read/parse error. */
  sources: ReadonlyArray<{
    path: string;
    scope?: string;
    exists: boolean;
    value?: Record<string, unknown>;
    error?: string;
  }>;
};

export type ArrayPolicy = "concat" | "replace" | "dedupe";

export type LoadSettingsHierarchyOptions = {
  /** Files to read, in increasing-priority order. Later wins. */
  files: ReadonlyArray<string | SettingsSource>;
  /**
   * Per-key array merge policy. Keyed by JSON path joined with ".".
   * E.g. { "permissions.allow": "concat", "hooks": "replace" }.
   * Default for unspecified keys: "concat".
   */
  arrayPolicy?: Record<string, ArrayPolicy>;
};

export type MergeSettingsOptions = {
  arrayPolicy?: Record<string, ArrayPolicy>;
  /** Internal — current key path during recursion. Default: "". */
  path?: string;
};

type SourceRecord = {
  path: string;
  scope?: string;
  exists: boolean;
  value?: Record<string, unknown>;
  error?: string;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  if (Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function normalizeSource(entry: string | SettingsSource): SettingsSource {
  return typeof entry === "string" ? { path: entry } : entry;
}

function dedupeArray(items: ReadonlyArray<unknown>): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Pure deep merge of two settings objects.
 *
 * - Object + object → recurse into shared keys, copy unique keys from both.
 * - Array + array → consult `arrayPolicy[currentPath]` (default `"concat"`).
 * - Scalar + anything → override wins.
 * - Null in override → kept (explicit unset).
 */
export function mergeSettings(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
  opts: MergeSettingsOptions = {},
): Record<string, unknown> {
  const arrayPolicy = opts.arrayPolicy ?? {};
  const path = opts.path ?? "";
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(base)) {
    out[k] = base[k];
  }
  for (const k of Object.keys(override)) {
    const childPath = path ? `${path}.${k}` : k;
    const overrideVal = override[k];
    const baseVal = base[k];
    if (overrideVal === null) {
      // explicit unset — keep null verbatim
      out[k] = null;
      continue;
    }
    if (Array.isArray(baseVal) && Array.isArray(overrideVal)) {
      const policy = arrayPolicy[childPath] ?? "concat";
      if (policy === "replace") {
        out[k] = [...overrideVal];
      } else if (policy === "dedupe") {
        out[k] = dedupeArray([...baseVal, ...overrideVal]);
      } else {
        out[k] = [...baseVal, ...overrideVal];
      }
      continue;
    }
    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      out[k] = mergeSettings(baseVal, overrideVal, { arrayPolicy, path: childPath });
      continue;
    }
    out[k] = overrideVal;
  }
  return out;
}

/**
 * Read a list of JSON settings files in order and deep-merge them.
 *
 * Missing files are skipped (recorded with `exists: false`). Malformed JSON is
 * skipped with `error` set. The reader is sync because settings load is a
 * startup-time concern over a small number of files.
 */
export function loadSettingsHierarchy(opts: LoadSettingsHierarchyOptions): SettingsLoadResult {
  const arrayPolicy = opts.arrayPolicy ?? {};
  let merged: Record<string, unknown> = {};
  const sources: SourceRecord[] = [];
  for (const entry of opts.files) {
    const src = normalizeSource(entry);
    let raw: string;
    try {
      raw = readFileSync(src.path, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        sources.push({ path: src.path, scope: src.scope, exists: false });
        continue;
      }
      sources.push({
        path: src.path,
        scope: src.scope,
        exists: false,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      sources.push({
        path: src.path,
        scope: src.scope,
        exists: true,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    if (!isPlainObject(parsed)) {
      sources.push({
        path: src.path,
        scope: src.scope,
        exists: true,
        error: "settings root must be a JSON object",
      });
      continue;
    }
    sources.push({ path: src.path, scope: src.scope, exists: true, value: parsed });
    merged = mergeSettings(merged, parsed, { arrayPolicy });
  }
  return { merged, sources };
}
