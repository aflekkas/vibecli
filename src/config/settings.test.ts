import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettingsHierarchy, mergeSettings } from "./settings.ts";

let dir: string;

function write(name: string, body: string): string {
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "vibecli-settings-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadSettingsHierarchy", () => {
  test("empty file list returns empty merged + sources", () => {
    const result = loadSettingsHierarchy({ files: [] });
    expect(result.merged).toEqual({});
    expect(result.sources).toEqual([]);
  });

  test("missing file marked exists: false, no throw", () => {
    const result = loadSettingsHierarchy({
      files: [join(dir, "does-not-exist.json")],
    });
    expect(result.merged).toEqual({});
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].exists).toBe(false);
    expect(result.sources[0].error).toBeUndefined();
  });

  test("malformed JSON recorded with error, loader continues", () => {
    const bad = write("bad.json", "{ not json");
    const good = write("good.json", JSON.stringify({ a: 1 }));
    const result = loadSettingsHierarchy({ files: [bad, good] });
    expect(result.sources[0].exists).toBe(true);
    expect(result.sources[0].error).toBeDefined();
    expect(result.sources[1].exists).toBe(true);
    expect(result.sources[1].error).toBeUndefined();
    expect(result.merged).toEqual({ a: 1 });
  });

  test("scalar override wins across two sources", () => {
    const a = write("a.json", JSON.stringify({ port: 3000, host: "localhost" }));
    const b = write("b.json", JSON.stringify({ port: 4000 }));
    const { merged } = loadSettingsHierarchy({ files: [a, b] });
    expect(merged).toEqual({ port: 4000, host: "localhost" });
  });

  test("array default policy is concat", () => {
    const a = write("arr-a.json", JSON.stringify({ tags: ["x"] }));
    const b = write("arr-b.json", JSON.stringify({ tags: ["y"] }));
    const { merged } = loadSettingsHierarchy({ files: [a, b] });
    expect(merged).toEqual({ tags: ["x", "y"] });
  });

  test("scope label is propagated through to sources", () => {
    const p = write("scoped.json", JSON.stringify({ k: 1 }));
    const result = loadSettingsHierarchy({
      files: [{ path: p, scope: "user" }],
    });
    expect(result.sources[0].scope).toBe("user");
    expect(result.sources[0].value).toEqual({ k: 1 });
  });
});

describe("mergeSettings", () => {
  test("array policy 'replace' at nested key replaces, doesn't concat", () => {
    const merged = mergeSettings(
      { permissions: { allow: ["a", "b"] } },
      { permissions: { allow: ["c"] } },
      { arrayPolicy: { "permissions.allow": "replace" } },
    );
    expect(merged).toEqual({ permissions: { allow: ["c"] } });
  });

  test("array policy 'dedupe' removes duplicates (primitives + objects)", () => {
    const merged = mergeSettings(
      { tags: ["a", "b"], rules: [{ id: 1 }, { id: 2 }] },
      { tags: ["b", "c"], rules: [{ id: 2 }, { id: 3 }] },
      {
        arrayPolicy: {
          tags: "dedupe",
          rules: "dedupe",
        },
      },
    );
    expect(merged.tags).toEqual(["a", "b", "c"]);
    expect(merged.rules).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  test("nested object deep merge preserves keys from both sides", () => {
    const merged = mergeSettings(
      { server: { host: "localhost", port: 3000 } },
      { server: { port: 4000, tls: true } },
    );
    expect(merged).toEqual({
      server: { host: "localhost", port: 4000, tls: true },
    });
  });

  test("null override is preserved as explicit unset", () => {
    const merged = mergeSettings(
      { feature: { enabled: true, level: 5 } },
      { feature: null },
    );
    expect(merged).toEqual({ feature: null });
  });

  test("default array concat applies when no policy entry matches", () => {
    const merged = mergeSettings(
      { list: [1, 2] },
      { list: [3, 4] },
      { arrayPolicy: { "other.key": "replace" } },
    );
    expect(merged).toEqual({ list: [1, 2, 3, 4] });
  });

  test("scalar replaces array on type mismatch (override wins)", () => {
    const merged = mergeSettings({ x: [1, 2] }, { x: "now-a-string" });
    expect(merged).toEqual({ x: "now-a-string" });
  });
});
