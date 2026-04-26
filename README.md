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

## 🧰 What's in here

Each subpath is a separate import, no top-level grab-bag. Pull only what you need.

| Subpath | What you get |
|---|---|
| `@aflekkas/vibecli/text-input` | `<TextInput>` Ink widget with paste, undo, cursor navigation, multi-line buffer, and inline image-path detection |
| `@aflekkas/vibecli/clipboard` | macOS clipboard text + image extraction via `pbpaste` and `osascript`, plus tempfile writer for image-bearing prompts |
| `@aflekkas/vibecli/highlight` | Markdown code-fence syntax highlighter for streaming model output, language-aware theming |
| `@aflekkas/vibecli/ui` | `rgbToHex`, `hslToRgb`, `rainbowColorAt`, `pinkGradientAt`, `<GradientText>`, terminal-safe `wrapText` |
| `@aflekkas/vibecli/retry` | `withRetry()` exponential-backoff wrapper for the initial (non-stream) provider call |
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
    });
  }
}
```

Stream a turn. The adapter normalizes Anthropic and OpenAI events into one `StreamEvent` union (`text_delta`, `thinking_delta`, `tool_call`, `done`):

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

Wrap any flaky call in retry:

```ts
import { withRetry } from "@aflekkas/vibecli/retry";

const result = await withRetry(() => callProvider(), { retries: 3, baseMs: 500 });
```

## 🚧 Boundary

Code here is generic on purpose. The adapter inspects `"anthropic"` / `"openai"` strings to wire provider-specific options (cache control, prompt-cache keys, adaptive thinking), but nothing else app-specific belongs here: no runtime artifact paths (`.rawdog/`, `.foocli/`), no specific tool names, no slash commands, no imports from any consumer. If a feature needs app context, take it as a constructor arg, function param, or React prop.

Promotion to vibecli later is cheap. Demotion after publish is an API break. When in doubt, build it in the consumer first.

## 🔧 Local development

```bash
bun install
bun run typecheck
```

No test suite yet, verify changes by exercising rawdog (the canonical consumer). To iterate against a consuming CLI without publishing every edit:

```bash
# in vibecli
bun link

# in the consuming CLI
bun link @aflekkas/vibecli
```

Unlink and bump the pin in the consumer once the change ships to npm.

## 📄 License

MIT
