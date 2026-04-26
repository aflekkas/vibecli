# Configuration

vibecli exposes generic defaults, but consumers should be able to bring their own colors, copy, loading behavior, key behavior, retry policy, and provider options without forking a primitive.

## UI Config

Use `VibeConfigProvider` from `@aflekkas/vibecli/config` as the source of truth for Ink UI defaults. The same config shape can be passed directly to non-React helpers.

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
      submitOn: ["meta+return"],
      newlineOn: ["return"],
      historyPrevOn: [],
      tabText: "\t",
      maxUndo: 100,
    },
  },
  messages: {
    roles: {
      user: { prefix: "> ", color: "cyan" },
      assistant: { prefix: "ai> ", color: "#38bdf8" },
      thinking: { prefix: ". ", color: "gray", dim: true },
    },
    closeHint: "Enter/Esc close",
    scrollHint: "up/down scroll",
  },
  loading: {
    labels: ["Thinking", "Working"],
    frames: [".", "o", "O", "o"],
    statusSeparator: " - ",
  },
};

<VibeConfigProvider config={uiConfig}>
  <GradientText text="vibecli" />
  <TextInput value={value} onChange={setValue} onSubmit={send} />
</VibeConfigProvider>;
```

Config sections are merged, so consumers only override the fields they care about. Direct component props still win for one-off changes.

## Theme

Use `createTheme()` from `@aflekkas/vibecli/ui` when you need a standalone theme object, or set `theme` inside the shared config.

```tsx
import { GradientText, createTheme } from "@aflekkas/vibecli/ui";

const theme = createTheme({
  colors: { accent: "#38bdf8" },
  gradient: { hueStart: 190, hueSpan: 120 },
});

<GradientText text="vibecli" theme={theme} />;
```

`GradientText` also accepts a `gradient` override for one-off changes, or a `colorAt` callback when the consumer needs full control per character.

## TextInput

`TextInput` reads `textInput.placeholder` and `textInput.options` from `VibeConfigProvider`. It also accepts the same values as direct props.

```tsx
import { TextInput } from "@aflekkas/vibecli/text-input";

<TextInput
  value={value}
  onChange={setValue}
  placeholder="ask anything"
  theme={theme}
  options={{
    submitOn: ["meta+return"],
    newlineOn: ["return"],
    historyPrevOn: [],
    tabText: "\t",
    maxUndo: 100,
  }}
/>;
```

Top-level `placeholderColor`, `maxUndo`, and `tabText` props are kept for simple use. Direct `options` win over provider config.

## Loading and Messages

The config does not prescribe an app layout. It gives consumers one place to store generic display conventions and helper functions to render them.

```ts
import {
  createVibeConfig,
  formatLoadingStatus,
  loadingFrameAt,
  loadingLabelAt,
} from "@aflekkas/vibecli/config";

const config = createVibeConfig({
  loading: {
    labels: ["Thinking", "Working"],
    frames: [".", "o", "O", "o"],
  },
});

const frame = loadingFrameAt(config.loading, tick);
const label = loadingLabelAt(config.loading, turn);
const status = formatLoadingStatus(config.loading, {
  seconds: 12,
  status: "running tool",
  queued: 2,
});
```

`messages.roles` is intentionally just prefixes and Ink text style metadata. Rendering the transcript remains the consumer's job.

## Highlighting

`highlight()` accepts ANSI sequences for every token class.

```ts
import { highlight } from "@aflekkas/vibecli/highlight";

const output = highlight(markdown, {
  config: uiConfig,
  theme: {
    keyword: "\x1b[36m",
    string: "\x1b[32m",
    number: "\x1b[33m",
  },
});
```

## Provider Adapter

`AiSdkProvider` keeps provider-specific defaults, but constructor options can turn them off or replace them.

```ts
import { AiSdkProvider } from "@aflekkas/vibecli/providers/adapter";

const provider = new AiSdkProvider({
  name: "openai",
  model: "gpt-4.1",
  languageModel,
  sessionId: "stable-session-id",
  retry: { retries: 2, baseMs: 250 },
  providerOptions: ({ sessionId }) => ({
    openai: { promptCacheKey: sessionId },
  }),
  openai: {
    user: false,
  },
});
```

Anthropic options include `cacheControl`, `thinking`, and `maxOutputTokens`. OpenAI options include `promptCacheKey` and `user`.

## Clipboard Temp Files

Clipboard image helpers write temporary files with generic defaults. Consumers can set the temp directory or filename prefix.

```ts
import { readClipboardImage, writeTempImage } from "@aflekkas/vibecli/clipboard";

const image = await readClipboardImage({ prefix: "my-cli-paste" });
const path = await writeTempImage(buffer, ".png", { dir: ".tmp", prefix: "my-cli" });
```
