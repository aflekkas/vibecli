# 🛠️ vibecli

> Skip the AI CLI boilerplate

Reusable Ink + AI SDK primitives for vibecoded CLIs. Extracted from [rawdog](https://github.com/aflekkas/rawdog).

## Status

Pre-alpha. API will move. Used in production by rawdog.

## Install

```bash
bun add vibecli
# or
npm install vibecli
```

vibecli declares peer dependencies on `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `ink`, and `react` — install whichever your CLI uses.

## What's in here

| Subpath | Purpose |
|---|---|
| `vibecli/text-input` | Ink `<TextInput>` with paste, undo, cursor navigation |
| `vibecli/clipboard` | macOS clipboard text + image extraction |
| `vibecli/highlight` | Markdown code-fence syntax highlighter |
| `vibecli/ui` | Color math, gradient text, terminal text wrapping |
| `vibecli/retry` | Exponential-backoff retry wrapper |
| `vibecli/providers` | Generic `Message` / `ContentBlock` / `Provider` / `ToolDef` types |
| `vibecli/providers/adapter` | Vercel AI SDK adapter (`AiSdkProvider`) |

## Example

```ts
import { TextInput } from "vibecli/text-input";
import { AiSdkProvider } from "vibecli/providers/adapter";
import { createOpenAI } from "@ai-sdk/openai";

class MyProvider extends AiSdkProvider {
  constructor() {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    super({ name: "openai", model: "gpt-4.1", languageModel: openai("gpt-4.1") });
  }
}
```

## Boundary

Code here must be generic. No app-specific provider names, config paths, slash commands, or tool names. If a feature needs app context, accept it via params — never inline it here.

## Local development

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

## License

MIT
