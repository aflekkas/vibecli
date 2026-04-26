export type Frontmatter = {
  data: Record<string, string>;
  body: string;
};

/**
 * Parses a `---`-delimited YAML-like frontmatter block from the start of `raw`.
 * Returns `null` when no opening fence is found.
 * Keys are lowercased; single- and double-quoted values are unquoted.
 */
export function parseFrontmatter(raw: string): Frontmatter | null {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n") && !text.startsWith("---\r")) return null;
  const lines = text.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  const data: Record<string, string> = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    data[m[1].toLowerCase()] = val;
  }
  const body = lines.slice(end + 1).join("\n").replace(/^\n+/, "");
  return { data, body };
}

export function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  const s = v.toLowerCase();
  if (s === "true" || s === "yes" || s === "1") return true;
  if (s === "false" || s === "no" || s === "0") return false;
  return fallback;
}

/**
 * Extracts the first non-empty, non-heading line from `body` as a short
 * description, ellipsized to `maxLen` characters (default 160).
 */
export function deriveDescription(body: string, maxLen = 160): string {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    return line.length > maxLen ? line.slice(0, maxLen - 1) + "…" : line;
  }
  return "";
}
