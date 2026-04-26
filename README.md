# 🛠️ vibecli

> Skip the AI CLI boilerplate

[![My Skills](https://skillicons.dev/icons?i=ts,bun,react)](https://skillicons.dev)

Reusable Ink + AI SDK primitives for vibecoded CLIs. Extracted from [rawdog](https://github.com/aflekkas/rawdog).

## 🧭 Status

Pre-alpha. API will move. Used in production by rawdog.

## 📦 Install

```bash
bun add vibecli
# or
npm install vibecli
```

vibecli declares peer dependencies on `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `ink`, and `react`, install whichever your CLI uses.

## 🧰 What's in here

| Subpath | Purpose |
|---|---|
| `@aflekkas/vibecli/text-input` | Ink `<TextInput>` with paste, undo, cursor navigation |
| `@aflekkas/vibecli/clipboard` | macOS clipboard text + image extraction |
| `@aflekkas/vibecli/highlight` | Markdown code-fence syntax highlighter |
| `@aflekkas/vibecli/ui` | Color math, gradient text, terminal text wrapping |
| `@aflekkas/vibecli/retry` | Exponential-backoff retry wrapper |
| `@aflekkas/vibecli/providers` | Generic `Message` / `ContentBlock` / `Provider` / `ToolDef` types |
| `@aflekkas/vibecli/providers/adapter` | Vercel AI SDK adapter (`AiSdkProvider`) |

## 🚀 Usage

```ts
import { TextInput } from "@aflekkas/vibecli/text-input";
import { AiSdkProvider } from "@aflekkas/vibecli/providers/adapter";
import { createOpenAI } from "@ai-sdk/openai";

class MyProvider extends AiSdkProvider {
  constructor() {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    super({ name: "openai", model: "gpt-4.1", languageModel: openai("gpt-4.1") });
  }
}
```

## 🚧 Boundary

Code here must be generic. No app-specific provider names, config paths, slash commands, or tool names. If a feature needs app context, accept it via params, never inline it here.

## 🔧 Local development

```bash
bun install
bun run typecheck
```

To test changes against a consuming CLI without publishing:

```bash
# in vibecli
bun link

# in the consuming CLI
bun link vibecli
```

Unlink and bump version when you ship.

## 📄 License

MIT
