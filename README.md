# 🛠️ vibecli

[![npm](https://img.shields.io/npm/v/@aflekkas/vibecli.svg)](https://www.npmjs.com/package/@aflekkas/vibecli)

Building a TUI agent on Ink + the Vercel AI SDK means rewriting the same primitives every time: a text input that survives paste and cursor nav, clipboard image extraction, a markdown highlighter for streaming output, exponential backoff for flaky provider calls, and an SDK adapter that knows about Anthropic prompt caching. vibecli is the layer [rawdog](https://github.com/aflekkas/rawdog) factored out so the next vibecoded CLI starts at minute zero, not minute thirty.

Pre-alpha. The API will move, pin a version and expect breakage on minor bumps.

## 📦 Install

```bash
bun add @aflekkas/vibecli
# or
npm install @aflekkas/vibecli
```

Peer deps live in your CLI: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `ink`, `react`. Install whichever you actually use, vibecli stays provider-agnostic at the top.

## ⚡ Scaffold

Bootstrap a fresh Ink app pre-wired to vibecli's primitives:

```bash
bunx @aflekkas/vibecli init my-cli
cd my-cli && bun install && bun run dev
```

Flags: `--name <pkg>`, `--pm bun|npm`, `--vibecli <version>`, `--force`. The scaffolder writes `package.json`, `tsconfig.json`, `src/index.tsx`, `README.md`, and `.gitignore`.

The `vibecli` bin uses a `#!/usr/bin/env bun` shebang, so bun must be on `PATH` to invoke it directly. `bunx` is the safest entry point.

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
| `@aflekkas/vibecli/providers` | Generic `Message`, `ContentBlock`, `ToolDef`, `Provider`, `StreamEvent` types you build against |
| `@aflekkas/vibecli/providers/adapter` | `AiSdkProvider`, Vercel AI SDK adapter wired for Anthropic prompt caching, adaptive thinking, and OpenAI prompt-cache keys |

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

Direct props still win for one-off overrides. `GradientText` accepts `theme`, `gradient`, or `colorAt`; `TextInput` accepts `placeholder`, `placeholderColor`, and `options`; `highlight(markdown, { config, theme })` accepts the same config object plus ANSI token overrides.

More docs:

- [`docs/configuration.md`](docs/configuration.md)
- [`docs/cli.md`](docs/cli.md)

## 🚧 Boundary

Code here is generic on purpose. The adapter inspects `"anthropic"` / `"openai"` strings to wire provider-specific options (cache control, prompt-cache keys, adaptive thinking), but nothing else app-specific belongs here: no runtime artifact paths (`.rawdog/`, `.foocli/`), no specific tool names, no slash commands, no imports from any consumer. If a feature needs app context, take it as a constructor arg, function param, or React prop.

Promotion to vibecli later is cheap. Demotion after publish is an API break. When in doubt, build it in the consumer first.

## 🔧 Local development

```bash
bun install
bun run typecheck
```

No test suite yet. Verify changes by type-checking here, then shipping a real npm version and exercising rawdog (the canonical consumer):

```bash
bun run typecheck
git add . && git commit -m "Organize internals"
bun run ship
```

rawdog intentionally consumes only the published package, so integration failures match what another consumer would see.

## 📄 License

MIT
