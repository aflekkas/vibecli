# __NAME__

Ink + AI SDK agent CLI scaffolded with vibecli (template: `playground`).

The playground is the kitchen-sink template: it wires up a working chat against `claude-sonnet-4-5`, plus slash commands that demonstrate vibecli primitives (theming, clipboard image paste, conversation reset). Strip out what you don't need; copy the patterns into your own app.

## Run

```bash
cp .env.example .env  # then paste your ANTHROPIC_API_KEY
bun install
bun run dev
```

## Slash commands

- `/theme` — switch theme live (uses `@aflekkas/vibecli/theme-picker`)
- `/clip` — stage clipboard image for next message (uses `@aflekkas/vibecli/clipboard`)
- `/clear` — reset the conversation
- `/help` — list commands
- empty submit — exit

## Identity / system prompt

The CLI's persona lives in one string in `src/index.tsx`:

```ts
const SYSTEM_PROMPT = "You are a helpful CLI assistant. Be concise.";
```

Edit it to give the agent a name, voice, rules, role. Swap at runtime with `agent.setSystem("new prompt")`.

## Swap the model

The default is `claude-sonnet-4-5` via `@ai-sdk/anthropic`. Any Vercel AI SDK provider works. Three lines in `src/index.tsx`:

1. Install the provider: `bun add @ai-sdk/openai` (or `@ai-sdk/google`, `@ai-sdk/groq`, etc.)
2. Replace the import: `import { openai } from "@ai-sdk/openai";`
3. Update the `AiSdkProvider` constructor: change `name` to `"openai"`, `MODEL` to e.g. `"gpt-4.1"`, and `languageModel` to `openai(MODEL)`.

Set the matching API key env var (`OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, etc.). The AI SDK reads these automatically.

## Add tools

Pass a `tools` array to `createAgent`:

```ts
createAgent(provider, system, {
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
```

The agent loop calls your handlers when the model emits tool calls, and feeds results back automatically.
