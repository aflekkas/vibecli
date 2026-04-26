# 🛠️ vibecli

[![npm](https://img.shields.io/npm/v/@aflekkas/vibecli.svg)](https://www.npmjs.com/package/@aflekkas/vibecli)

Stand up your own CLI agent in an afternoon. Agents are loops. Harnesses inject context and run commands. vibecli ships the primitives so the rest is yours.

Pre-alpha. The API will move, pin a version and expect breakage on minor bumps.

## 🧠 Thesis

An AI agent is a loop: build a prompt, call the model, run the tool calls, feed results back, repeat until done. A harness around that loop is a context-injector and a command-runner. Strip the brand off Claude Code, Cursor, Cline, or Aider and you find the same skeleton. vibecli is that skeleton as small, single-purpose primitives — provider plumbing, an agent loop, an Ink text input that survives paste, a markdown highlighter, theming, slash commands from a directory of `.md` files, scripted scenarios — plus a `vibecli init` scaffolder that drops you into a runnable Ink + AI-SDK CLI in one command.

The motivating use case is the company that needs an internal CLI agent and cannot use the closed products. They have OAuth, internal data, domain-specific tools, security review. They cannot send their codebase to a vendor and they cannot fork a SaaS UI. So they vibecode their own CLI on vibecli, ship it as a binary to their team, and own every product decision. The same shape works for the solo founder wrapping their SaaS API, the research lab over their dataset, the consultant shipping a one-off deliverable, and the hobbyist with personal notes.

The convention layer leans on the filesystem. Slash commands are markdown files in a directory. Themes are objects in a registry. Scenarios are scripted JSON. Agent identity is a string. Settings are a hierarchy of JSON files. Permissions are glob patterns. There is no framework to extend, no plugin manifest, no inversion of control. You write the loop's caller, the input handler, the tool runners, and the rendering. vibecli ships the parts that benefit from sharing, in `src/` modules small enough to read in one sitting.

This is a library, not a framework, and not a product. The package surface is functions and React components. The in-tree `templates/playground/` is demo wiring, not API. The boundary is real: nothing in `src/` knows about any specific consumer. Pre-alpha is honest about API churn — pin a version, read the release notes, expect every change to break something until proven otherwise.

A natural next primitive is multi-agent coordination — a planner that hands off to specialists, a supervisor watching a long-running task, an inspector auditing another agent's tool calls. Each of those is, again, just a loop with disciplined IO around it. Direction, not commitment.

Full thesis: [THESIS.md](./THESIS.md).

## 📦 Install

```bash
bun add @aflekkas/vibecli
# or
npm install @aflekkas/vibecli
```

Peer deps live in your CLI: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `ink`, `react`. Install whichever you actually use, vibecli stays provider-agnostic at the top.

## ⚡ Scaffold

Bootstrap a fresh Ink + AI SDK agent CLI, pre-wired to vibecli's primitives. Deps install automatically.

```bash
bunx @aflekkas/vibecli init my-cli
cd my-cli
cp .env.example .env  # paste your OPENAI_API_KEY
bun run dev
```

The default scaffold ships a working chat loop against `claude-sonnet-4-5` via `@ai-sdk/anthropic`. Any Vercel AI SDK provider works — the generated `README.md` documents the 3-line swap (install `@ai-sdk/<provider>`, change one import, change one constructor arg).

### Templates

The scaffolder copies a real, runnable template from `templates/<name>/` inside the published package. Today vibecli ships one built-in template:

- **`playground`** (default) — kitchen-sink demo wiring up the agent loop, theming, theme picker, clipboard image paste, and slash commands (`/theme`, `/clip`, `/clear`, `/help`). The intent is to demonstrate as many vibecli primitives as possible in a single file you can edit down. Also serves as the reference target for vibecli's own pre-release smoke tests.

Pick one with `--template <name>`. Future versions will ship more built-ins and accept community-contributed templates by short name.

Flags: `--template <name>`, `--name <pkg>`, `--pm bun|npm`, `--vibecli <version>`, `--theme <name>`, `--no-prompt`, `--no-install` (skip auto-install), `--force` (overwrite existing files). The scaffolder writes `package.json`, `tsconfig.json`, `src/index.tsx`, `.env.example`, `README.md`, and `.gitignore`, then runs `bun install` (or `npm install`) in the new directory.

The `vibecli` bin uses a `#!/usr/bin/env bun` shebang, so bun must be on `PATH` to invoke it directly. `bunx` is the safest entry point.

## 🤖 Docs MCP

Point a coding agent at the same docs you're reading right now. `bunx @aflekkas/vibecli mcp` runs **locally over stdio** — it's a thin wrapper around the README and `docs/*.md` that already ship inside the package. No hosted service, no network, no daemon: the AI client spawns the bin, the bin streams MCP messages on stdin/stdout, and the process exits when the client disconnects.

The point is to give an AI agent a structured handle on the current `0.0.x` API instead of falling back to training-data guesses or stale web search.

Register with Claude Code:

```bash
claude mcp add vibecli -- bunx @aflekkas/vibecli mcp
```

Any other MCP-capable client (Cursor, mcp-inspector, etc.) registers the same way against `bunx @aflekkas/vibecli mcp`.

What it exposes:

- **Resources**: `vibecli://readme`, `vibecli://docs/configuration`, `vibecli://docs/cli`, `vibecli://exports` (the `package.json` `exports` map plus the subpath catalog as JSON).
- **Tools**: `list_subpaths` (every importable subpath with a one-line summary) and `get_subpath_docs({ name })` (per-subpath summary, canonical import statement, and a pointer into the README example).

The server's docs version is the package's docs version. `bun update @aflekkas/vibecli` is also a docs bump for any agent connected to it.

## 🧰 What's in here

Use subpath imports for focused code. The root package also re-exports the current primitives for convenience.

| Subpath | What you get |
|---|---|
| `@aflekkas/vibecli/text-input` | `<TextInput>` Ink widget with configurable submit/newline/history bindings, paste, undo, cursor navigation, and multi-line buffer support |
| `@aflekkas/vibecli/clipboard` | Image-file helpers, macOS clipboard image extraction via `osascript`, dragged image-path extraction, and tempfile writer for image-bearing prompts |
| `@aflekkas/vibecli/highlight` | Markdown code-fence syntax highlighter for streaming model output, language-aware theming |
| `@aflekkas/vibecli/ui` | Theme helpers, gradient colors/text, color math, and terminal-safe `wrapText` |
| `@aflekkas/vibecli/config` | `VibeConfigProvider`, shared UI config, loading/message defaults, and merge helpers |
| `@aflekkas/vibecli/retry` | `withRetry()` exponential-backoff wrapper for the initial (non-stream) provider call |
| `@aflekkas/vibecli/create-project` | Programmatic Ink app scaffold writer used by `vibecli init` |
| `@aflekkas/vibecli/checkpoints` | Generic checkpoint history with undo/redo snapshots |
| `@aflekkas/vibecli/lsp` | Small LSP position/range and file URI conversion helpers |
| `@aflekkas/vibecli/mcp` | MCP tool/result normalization helpers for the generic provider tool types |
| `@aflekkas/vibecli/repo-map` | Lightweight repository file map, language summary, and kind classification |
| `@aflekkas/vibecli/status-line` | Status-line command runner and truncation helpers |
| `@aflekkas/vibecli/picker` | `<Picker>` Ink component — paginated, single-line-per-item modal menu with title, optional subtitle, descriptions, hints, page indicator, and footer |
| `@aflekkas/vibecli/themes` | Built-in theme registry (`pink`, `ocean`, `matrix`, `amber`, `claude`, `mono`) plus `defineTheme({ accent, ... })` to author your own |
| `@aflekkas/vibecli/theme-picker` | `<ThemePicker>` Ink widget for live theme switching — arrow keys, enter, esc |
| `@aflekkas/vibecli/commands` | `DEFAULT_RESERVED` slash-command names (`help`, `clear`, `new`, `exit`, `quit`, `restart`, `paste`) plus `extendReserved(...sets)` to merge in your own |
| `@aflekkas/vibecli/slash` | `createSlashRegistry().add(name, handler, description?).dispatch(input) → "handled" \| "unknown" \| "not-slash"` — chainable slash-command builder with `help()` line generator |
| `@aflekkas/vibecli/frontmatter` | `parseFrontmatter()` for `---\nkey: value\n---` markdown headers, plus `parseBool` and `deriveDescription` helpers |
| `@aflekkas/vibecli/markdown-dir` | `loadMarkdownDir<T>()` — walks one or more dirs of `.md` files (or `dir/SKILL.md`-style entrypoints), parses each via your `parseEntry`, dedupes by name, skips reserved names |
| `@aflekkas/vibecli/providers` | Generic `Message`, `ContentBlock`, `ToolDef`, `Provider`, `StreamEvent` types you build against |
| `@aflekkas/vibecli/providers/adapter` | `AiSdkProvider`, Vercel AI SDK adapter wired for Anthropic prompt caching, adaptive thinking, and OpenAI prompt-cache keys |
| `@aflekkas/vibecli/agent` | `createAgent(provider, system, opts)` — provider-agnostic stream loop with tool execution, abort handling, tool-result truncation, optional auto-compaction, and lifecycle hooks |
| `@aflekkas/vibecli/scenarios` | `runScenario(agent, steps, opts?)` and `runScenarioFile(path, agent, opts?)` — scripted scenario runner for agent CLIs, drives a step list (or JSON file of steps), asserts on assistant text, returns a structured result |
| `@aflekkas/vibecli/chat` | `useAgentStream(agent, opts?)` React hook (turns reducer, streaming text accumulator, busy + AbortController, `onEvent` for tool/usage/abort/compaction surfacing, `onBeforeSend` for checkpoint snapshotting) and `<MessageList>` Ink component that renders turns with per-role styling from `useVibeConfig().messages.roles` |
| `@aflekkas/vibecli/models` | `defineModel({ id, providerName, build })` registry helper plus `<ModelPicker models value onPick onCancel>` Ink widget — same modal shape as `<ThemePicker>` but for the multi-provider model router |
| `@aflekkas/vibecli/settings` | `loadSettingsHierarchy({ files, arrayPolicy? })` — reads multiple JSON files in order and deep-merges them (missing files silently skipped); `mergeSettings(base, override, opts?)` — pure deep merge with per-key array policy (`concat`, `replace`, `dedupe`) |
| `@aflekkas/vibecli/permissions` | `evaluatePermission({ tool, inputKey?, rules })` — pure glob-based allow/ask/deny rule evaluator (consumer interprets mode semantics in `onLifecycle`); `matchPermissionPattern(pattern, target)` — single-pattern test; `COMMON_PERMISSION_MODES` reference vocabulary; `<PermissionPrompt>` Ink modal for interactive allow/deny prompts |
| `vibecli mcp` (bin subcommand) | Local stdio MCP server that wraps this package's README + `docs/*.md`. Plug into Claude Code so an agent can scaffold a vibecli CLI against the current API. See the **Docs MCP** section above. |

## 📚 Docs

The docs are a small set of markdown files at the repo root and under [`docs/`](docs/). Each one cross-links its siblings at the bottom — browse from here on github, or point an MCP-capable agent at `bunx @aflekkas/vibecli mcp` to read the same content over the wire.

| Page | What's in it |
|---|---|
| [`THESIS.md`](THESIS.md) | The why. Agents as loops, harness as context-injector + command-runner, files-and-folders as the API, motivating use case, and explicit anti-thesis. |
| [`docs/cli.md`](docs/cli.md) | `vibecli init` flag-by-flag reference (theme, package manager, prompt + install toggles), `vibecli mcp` resources/tools, and local-smoke recipe. |
| [`docs/configuration.md`](docs/configuration.md) | `VibeConfigProvider` shape, `<TextInput>` options, theme + gradient + role-message + loading defaults, highlighter ANSI overrides, `AiSdkProvider` per-provider knobs, and clipboard tempfile options. |

## 🚀 Usage

Wrap a Vercel AI SDK model into a `Provider`:

```ts
import { AiSdkProvider } from "@aflekkas/vibecli/providers/adapter";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });

class MyProvider extends AiSdkProvider {
  constructor() {
    super({
      name: "openai",
      model: "gpt-4.1",
      languageModel: openai("gpt-4.1"),
      providerOptions: ({ sessionId }) => ({
        openai: { promptCacheKey: sessionId },
      }),
    });
  }
}
```

Stream a turn. The adapter normalizes AI SDK events into one `StreamEvent` union (`text_delta`, `thinking_delta`, `tool_call`, `done`):

```ts
const provider = new MyProvider();
for await (const event of provider.stream({ system, messages, tools, signal })) {
  if (event.type === "text_delta") process.stdout.write(event.text);
  if (event.type === "tool_call") runTool(event.call);
}
```

Run a streaming agent loop with tool execution:

```ts
import { createAgent } from "@aflekkas/vibecli/agent";

const agent = createAgent(provider, "You are a helpful CLI assistant.", {
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

for await (const ev of agent.send("what time is it?")) {
  if (ev.type === "text") process.stdout.write(ev.text);
  if (ev.type === "tool_start") console.error(`[tool] ${ev.name}`);
}
```

Render the chat itself with one hook + one component — the hook owns the turns reducer, streaming-text accumulator, busy state, and abort controller; the component pulls per-role colors from `VibeConfigProvider`:

```tsx
import { useAgentStream, MessageList } from "@aflekkas/vibecli/chat";
import { TextInput } from "@aflekkas/vibecli/text-input";

function Chat({ agent }: { agent: Agent }) {
  const { turns, send, busy, pushMeta, reset } = useAgentStream(agent);
  const [input, setInput] = useState("");
  return (
    <Box flexDirection="column" gap={1}>
      <MessageList turns={turns} />
      <TextInput
        value={input}
        onChange={setInput}
        placeholder={busy ? "thinking..." : "ask anything"}
        onSubmit={(text) => { setInput(""); void send(text); }}
      />
    </Box>
  );
}
```

Smoke-test a CLI by scripting a sequence of user inputs and assertions against the assistant's text:

```ts
import { runScenario, type ScenarioStep } from "@aflekkas/vibecli/scenarios";

const steps: ScenarioStep[] = [
  { input: "say hi", expectContains: "hi" },
  { input: "what is 2+2?", expectMatches: /\b4\b/ },
];

const result = await runScenario(agent, steps);
if (result.failed > 0) process.exit(1);
```

Build a slash-command dispatcher and dispatch from any input handler:

```ts
import { createSlashRegistry } from "@aflekkas/vibecli/slash";

const slash = createSlashRegistry()
  .add("clear", () => reset(), "clear the conversation")
  .add("theme", () => openThemePicker(), "switch theme")
  .add("help", () => pushMeta(slash.help()), "list available commands");

// In a TextInput onSubmit handler:
const result = await slash.dispatch(input);
if (result === "not-slash") await send(input);
if (result === "unknown") pushMeta(`unknown command: ${input}`);
```

Load layered JSON settings files with configurable array-merge policies:

```ts
import { loadSettingsHierarchy, mergeSettings } from "@aflekkas/vibecli/settings";

const { merged, sources } = loadSettingsHierarchy({
  files: [
    { path: `${process.env.HOME}/.myapp/settings.json`, scope: "user" },
    { path: `${process.cwd()}/.myapp/settings.json`, scope: "project" },
  ],
  arrayPolicy: {
    "permissions.allow": "concat",
    "hooks": "replace",
  },
});
// sources[n].exists / .error for diagnostics; merged is the final config.
```

Drop `<TextInput>` into an Ink app:

```tsx
import { TextInput } from "@aflekkas/vibecli/text-input";

<TextInput
  value={value}
  onChange={setValue}
  onSubmit={(text) => send(text)}
  placeholder="ask anything"
/>
```

Configure key behavior without forking the component:

```tsx
<TextInput
  value={value}
  onChange={setValue}
  onSubmit={(text) => send(text)}
  options={{
    newlineOn: ["return"],
    submitOn: ["meta+return"],
    historyPrevOn: [],
    tabText: "\t",
  }}
/>
```

Wrap any flaky call in retry:

```ts
import { withRetry } from "@aflekkas/vibecli/retry";

const result = await withRetry(() => callProvider(), { retries: 3, baseMs: 500 });
```

Create undoable snapshots around any app-defined state:

```ts
import { createCheckpointHistory } from "@aflekkas/vibecli/checkpoints";

const history = createCheckpointHistory({ files: [] });
history.checkpoint({ files: ["src/index.tsx"] }, "add entrypoint");
const previous = history.undo();
```

Build compact repo context and convert offsets to LSP ranges:

```ts
import { buildRepoMap } from "@aflekkas/vibecli/repo-map";
import { rangeAt } from "@aflekkas/vibecli/lsp";

const map = await buildRepoMap(process.cwd(), { maxFiles: 300 });
const range = rangeAt(source, match.index, match.index + match[0].length);
```

Normalize MCP tools/results into vibecli provider primitives:

```ts
import { mcpResultToText, mcpToolsToToolDefs } from "@aflekkas/vibecli/mcp";

const tools = mcpToolsToToolDefs(await client.listTools());
const text = mcpResultToText(await client.callTool({ name, arguments: input }));
```

Render a modal menu over your TUI. The host owns selection state and key handling; `<Picker>` is the visual:

```tsx
import { Picker, type PickerItem } from "@aflekkas/vibecli/picker";

const items: PickerItem[] = [
  { key: "a", label: "Restart", description: "Reload the agent" },
  { key: "b", label: "Exit", description: "Quit the CLI" },
];

<Picker
  title="actions"
  items={items}
  selected={selected}
  columns={process.stdout.columns ?? 80}
  rows={process.stdout.rows ?? 24}
/>;
```

Scaffold a small Ink app from the package binary:

```bash
bunx @aflekkas/vibecli init my-cli
```

## ⚙️ Configuration

Use one config object as the source of truth for text UI defaults: theme, text input behavior, message prefixes, loading copy, spinner frames, and highlighter colors.

```tsx
import { VibeConfigProvider } from "@aflekkas/vibecli/config";
import { GradientText } from "@aflekkas/vibecli/ui";
import { TextInput } from "@aflekkas/vibecli/text-input";

const uiConfig = {
  theme: {
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
  },
  textInput: {
    placeholder: "ask anything",
    options: {
      newlineOn: ["return"],
      submitOn: ["meta+return"],
    },
  },
  messages: {
    roles: {
      assistant: { prefix: "ai> ", color: "#38bdf8" },
    },
  },
  loading: {
    labels: ["Thinking", "Working"],
    frames: [".", "o", "O", "o"],
  },
};

<VibeConfigProvider config={uiConfig}>
  <GradientText text="my-cli" />
  <TextInput value={value} onChange={setValue} onSubmit={send} />
</VibeConfigProvider>;
```

### 🎨 Theming

Pick a built-in or define your own. A theme is just a `VibeConfigInput` — pass it to `VibeConfigProvider` and every primitive picks it up.

```tsx
import { VibeConfigProvider } from "@aflekkas/vibecli/config";
import { themes, defineTheme } from "@aflekkas/vibecli/themes";
import { ThemePicker } from "@aflekkas/vibecli/theme-picker";

// Use a built-in: pink (default), ocean, matrix, amber, claude, mono.
<VibeConfigProvider config={themes.ocean}>{children}</VibeConfigProvider>;

// Define your own — gradient + role colors derive from accent.
const sunset = defineTheme({ accent: "#ff6b6b", secondary: "#feca57" });
<VibeConfigProvider config={sunset}>{children}</VibeConfigProvider>;

// Live theme switcher (arrow keys + enter).
<ThemePicker value={current} onPick={setCurrent} onCancel={close} />;
```

The `vibecli init` scaffolder prompts for a theme during setup (`--theme <name>` skips the prompt) and ships a `/theme` command in the generated app that opens `<ThemePicker>` for live switching.

Direct props still win for one-off overrides. `GradientText` accepts `theme`, `gradient`, or `colorAt`; `TextInput` accepts `placeholder`, `placeholderColor`, and `options`; `highlight(markdown, { config, theme })` accepts the same config object plus ANSI token overrides.

### 📂 Slash commands from a markdown directory

Compose `markdown-dir`, `frontmatter`, and `commands` to load user/project slash commands from `.md` files. The loader is generic over `T` — you pick the shape and write the per-entry parser.

```ts
import { loadMarkdownDir } from "@aflekkas/vibecli/markdown-dir";
import { parseFrontmatter, deriveDescription, parseBool } from "@aflekkas/vibecli/frontmatter";
import { DEFAULT_RESERVED, extendReserved } from "@aflekkas/vibecli/commands";

type SlashCommand = {
  name: string;
  description: string;
  body: string;
  enabled: boolean;
  source: string;
};

const commands = loadMarkdownDir<SlashCommand>({
  dirs: [
    { dir: `${process.env.HOME}/.myapp/commands`, source: "user" },
    { dir: `${process.cwd()}/.myapp/commands`, source: "project" },
  ],
  reserved: extendReserved(DEFAULT_RESERVED, ["foo", "bar"]),
  parseEntry: (raw, ctx) => {
    const fm = parseFrontmatter(raw);
    const data = fm?.data ?? {};
    const body = fm?.body ?? raw;
    return {
      name: data.name ?? ctx.name,
      description: data.description ?? deriveDescription(body),
      body,
      enabled: parseBool(data.enabled, true),
      source: ctx.path,
    };
  },
});
```

Project-source dirs override user-source dirs by name (later entries in `dirs` win). Pass `mode: "dir"` + `dirEntrypoint: "SKILL.md"` to load Claude-Code-style `commands/<name>/SKILL.md` layouts instead of flat files.

## 🚧 Boundary

Code in `src/` is generic on purpose. The adapter inspects `"anthropic"` / `"openai"` strings to wire provider-specific options (cache control, prompt-cache keys, adaptive thinking), but nothing else app-specific belongs there: no runtime artifact paths, no specific tool names, no slash commands, no imports from any consumer. If a feature needs app context, take it as a constructor arg, function param, or React prop.

The boundary applies to `src/` only. `templates/playground/` is the in-tree consumer — opinionated wiring, slash commands, demo flows live there. Promotion from the playground into `src/` is cheap. Demotion after publish is an API break. When in doubt, build it in the playground first.

## 🔧 Local development

```bash
bun install
bun run typecheck
```

This repo is itself built with a small claude-code-native stack — agents, skills, and slash commands live under [`.claude/`](.claude/) and `CLAUDE.md` orchestrates them. Open the directory if you're curious how the package is iterated on day to day.

vibecli has its own canonical consumer in-tree at `templates/playground/`. It resolves `@aflekkas/vibecli/*` to local `src/*` via tsconfig paths, so edits to `src/` show up next run with no install or symlink dance. Run it interactively or scripted:

```bash
bun run play                                          # interactive Ink chat against local src/
bun run play:script templates/playground/scenarios/<name>.json  # non-interactive, asserts assistant text
```

Verifying a release end-to-end:

```bash
bun run typecheck
git add . && git commit -m "organize internals"
bun run ship   # typecheck → version bump → npm publish → push tags → bun run smoke
```

`bun run smoke` (`scripts/smoke.ts`) scaffolds the `playground` template into a tmpdir from the just-published version, real `bun install`, runs every scripted scenario in `templates/playground/scenarios/`, asserts pass. That's the integration test on every release. Set `OPENAI_API_KEY` in env before shipping for full coverage; without it the smoke step skips silently.

## 🗺️ Roadmap

- **More built-in templates.** `playground` is the only template today. Future built-ins might include a minimal "barebones" starter, an MCP-server-first template, a tools-heavy template, etc. Built-ins ship inside the npm package under `templates/<name>/`.
- **Community / external templates.** `vibecli init --template <name>` will eventually resolve unknown names against a curated index (and/or `--template <github-user/repo>` for arbitrary git sources). The internal contract is already directory-shaped, so the surface to add is just resolution + caching.
- **Public `vibecli play` subcommand.** Today `bun run play` is a vibecli-internal dev script. A future `vibecli play [--template <name>]` would let consumers scaffold-and-run a template from any project against their installed version.
- **Headless UI scenarios.** Scripted scenarios cover the agent loop today. A future `--script-ui` mode (likely on top of `ink-testing-library`) would also exercise visual layout, slash-command UX, and theme switching non-interactively.

## 📄 License

MIT
