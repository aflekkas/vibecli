import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SubpathEntry = {
  subpath: string;
  summary: string;
};

const CATALOG: SubpathEntry[] = [
  { subpath: ".", summary: "Grab-bag re-exports of every primitive below. Convenient, but subpath imports give better tree-shaking and clearer intent." },
  { subpath: "text-input", summary: "<TextInput> Ink widget with configurable submit/newline/history bindings, paste, undo, cursor navigation, and multi-line buffer support." },
  { subpath: "clipboard", summary: "Image-file helpers, macOS clipboard image extraction via osascript, dragged image-path extraction, and tempfile writer for image-bearing prompts." },
  { subpath: "highlight", summary: "Markdown code-fence syntax highlighter for streaming model output, with language-aware theming." },
  { subpath: "ui", summary: "Theme helpers, gradient colors/text, color math, and terminal-safe wrapText." },
  { subpath: "config", summary: "VibeConfigProvider, shared UI config (theme, text input, message, loading defaults), and merge helpers." },
  { subpath: "retry", summary: "withRetry() exponential-backoff wrapper for the initial (non-stream) provider call." },
  { subpath: "create-project", summary: "Programmatic Ink app scaffold writer used by `vibecli init`." },
  { subpath: "checkpoints", summary: "Generic checkpoint history with undo/redo snapshots over any app-defined state." },
  { subpath: "lsp", summary: "LSP position/range and file URI conversion helpers." },
  { subpath: "mcp", summary: "MCP tool/result normalization helpers for the generic provider tool types." },
  { subpath: "repo-map", summary: "Lightweight repository file map, language summary, and kind classification." },
  { subpath: "status-line", summary: "Status-line command runner and truncation helpers." },
  { subpath: "providers", summary: "Generic Message, ContentBlock, ToolDef, Provider, StreamEvent types you build against." },
  { subpath: "providers/adapter", summary: "AiSdkProvider, Vercel AI SDK adapter wired for Anthropic prompt caching, adaptive thinking, and OpenAI prompt-cache keys." },
  { subpath: "agent", summary: "createAgent(provider, system, opts) — provider-agnostic stream loop with tool execution, abort handling, tool-result truncation, optional auto-compaction, and lifecycle hooks." },
  { subpath: "themes", summary: "Built-in theme definitions and the defineTheme() helper, plus themeNames/isThemeName for picker integration." },
  { subpath: "theme-picker", summary: "<ThemePicker> Ink widget for runtime theme switching." },
  { subpath: "commands", summary: "DEFAULT_RESERVED set of reserved slash-command names plus extendReserved() to merge in your own." },
  { subpath: "frontmatter", summary: "parseFrontmatter() for `---`-delimited markdown headers, plus parseBool and deriveDescription helpers." },
  { subpath: "markdown-dir", summary: "loadMarkdownDir<T>() — generic walker over one-or-more dirs of `.md` entries with reserved-name dedupe and caller-supplied parseEntry." },
];

function exportKeyToSubpath(key: string): string {
  if (key === ".") return ".";
  return key.startsWith("./") ? key.slice(2) : key;
}

function buildSubpathList(
  catalog: SubpathEntry[],
  exports: Record<string, string>,
  packageName: string,
): Array<{ subpath: string; importPath: string; summary: string }> {
  const exported = new Set(Object.keys(exports).map(exportKeyToSubpath));
  return catalog
    .filter((entry) => exported.has(entry.subpath))
    .map((entry) => ({
      subpath: entry.subpath,
      importPath: importPathFor(entry.subpath, packageName),
      summary: entry.summary,
    }));
}

type PackageManifest = {
  name: string;
  version: string;
  exports?: Record<string, string>;
};

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

function readPackageManifest(root: string): PackageManifest {
  const raw = readFileSync(path.join(root, "package.json"), "utf8");
  return JSON.parse(raw) as PackageManifest;
}

function importPathFor(subpath: string, packageName: string): string {
  return subpath === "." ? packageName : `${packageName}/${subpath}`;
}

function normalizeSubpath(input: string, packageName: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const prefix = `${packageName}/`;
  if (trimmed === packageName) return ".";
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  if (trimmed.startsWith("./")) return trimmed.slice(2);
  if (trimmed.startsWith("/")) return trimmed.slice(1);
  return trimmed;
}

function readDocSafely(root: string, relative: string): string | null {
  try {
    return readFileSync(path.join(root, relative), "utf8");
  } catch {
    return null;
  }
}

export async function runDocsMcpServer(): Promise<void> {
  const root = packageRoot();
  const pkg = readPackageManifest(root);
  const readme = readDocSafely(root, "README.md") ?? "";
  const configDoc = readDocSafely(root, "docs/configuration.md");
  const cliDoc = readDocSafely(root, "docs/cli.md");

  const subpaths = buildSubpathList(CATALOG, pkg.exports ?? {}, pkg.name);

  const exportsPayload = {
    name: pkg.name,
    version: pkg.version,
    exports: pkg.exports ?? {},
    subpaths,
  };

  const server = new McpServer(
    { name: "vibecli-docs", version: pkg.version },
    {
      capabilities: { resources: {}, tools: {} },
      instructions:
        "Local documentation server for @aflekkas/vibecli. Resources expose README and docs/*.md verbatim. Tools list subpaths and fetch per-subpath summaries. Point an AI agent at this to scaffold a vibecli-based CLI against the current API instead of training-data guesses.",
    },
  );

  server.registerResource(
    "readme",
    "vibecli://readme",
    {
      title: "vibecli README",
      description: "Full project README: install, scaffold, subpath table, usage examples, configuration.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: readme }],
    }),
  );

  if (configDoc !== null) {
    server.registerResource(
      "configuration",
      "vibecli://docs/configuration",
      {
        title: "vibecli configuration guide",
        description: "VibeConfigProvider, theme + UI config reference.",
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: configDoc }],
      }),
    );
  }

  if (cliDoc !== null) {
    server.registerResource(
      "cli",
      "vibecli://docs/cli",
      {
        title: "vibecli CLI guide",
        description: "`vibecli init` scaffolder reference: flags, themes, output layout.",
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: cliDoc }],
      }),
    );
  }

  const exportsText = JSON.stringify(exportsPayload, null, 2);
  server.registerResource(
    "exports",
    "vibecli://exports",
    {
      title: "vibecli exports + subpath catalog",
      description: "Package name, version, package.json exports map, and the subpath summary catalog.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: exportsText }],
    }),
  );

  server.registerTool(
    "list_subpaths",
    {
      title: "List subpaths",
      description: "List every importable subpath of @aflekkas/vibecli with its canonical import path and a one-line summary.",
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(subpaths, null, 2) }],
    }),
  );

  server.registerTool(
    "get_subpath_docs",
    {
      title: "Get subpath docs",
      description:
        "Return the summary and canonical import statement for one subpath, plus a hint for finding its full usage example in the README. Accepts a bare subpath (e.g. \"text-input\") or the full scoped form (\"@aflekkas/vibecli/text-input\").",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const subpath = normalizeSubpath(name, pkg.name);
      const entry = subpaths.find((s) => s.subpath === subpath);
      if (!entry) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown subpath: ${JSON.stringify(name)}. Call list_subpaths to see all supported names.`,
            },
          ],
        };
      }
      const payload = {
        subpath: entry.subpath,
        importPath: entry.importPath,
        summary: entry.summary,
        exampleHint: `Read resource vibecli://readme and search for \`from "${entry.importPath}"\` to find the canonical usage example.`,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    },
  );

  await server.connect(new StdioServerTransport());
}
