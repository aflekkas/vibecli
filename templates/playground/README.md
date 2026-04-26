# __NAME__

Ink + AI SDK agent CLI scaffolded with vibecli (template: `playground`).

The playground is the kitchen-sink template: it wires up a multi-model chat (OpenAI + Anthropic out of the box, switchable live via `/model`), plus slash commands that demonstrate vibecli primitives (theming, clipboard image paste, conversation reset). Strip out what you don't need; copy the patterns into your own app.

## Run

```bash
cp .env.example .env  # paste OPENAI_API_KEY and/or ANTHROPIC_API_KEY (only the keys for models you'll use)
bun install
bun run dev
```

## Slash commands

- `/model` — switch the active model live (router across configured providers)
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

## Models

The template ships with a `MODELS` registry in `src/index.tsx`. Each entry has an id, a provider name, and a `build()` thunk that returns a vibecli `Provider`. Type `/model` while running to switch live; the agent loop swaps providers between turns and keeps history.

Add a model by appending to the registry:

```ts
import { google } from "@ai-sdk/google";  // bun add @ai-sdk/google first

const MODELS = [
  // ...existing entries
  { id: "gemini-2.0-flash", providerName: "google", build: () => aiSdk("google", "gemini-2.0-flash", google) },
];
```

Set the matching API key env var (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, etc.). The AI SDK reads these automatically.

To change the default, edit `DEFAULT_MODEL_ID` to one of the registry ids.

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
