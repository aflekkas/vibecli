import React from "react";
import type { HighlightTheme } from "./highlight.ts";

export type GradientConfig = {
  hueStart: number;
  hueSpan: number;
  phaseSpeed?: number;
  saturation?: number;
  lightness?: number;
};

export type VibeTheme = {
  colors: {
    accent: string;
    muted: string;
    success: string;
    warning: string;
    error: string;
    placeholder: string;
  };
  gradient: GradientConfig;
};

export type VibeThemeInput = Partial<{
  colors: Partial<VibeTheme["colors"]>;
  gradient: Partial<GradientConfig>;
}>;

export type TextInputSpecialKey =
  | "return"
  | "tab"
  | "escape"
  | "up"
  | "down"
  | "left"
  | "right"
  | "backspace"
  | "delete";

export type TextInputKeyBinding = {
  key?: TextInputSpecialKey | string;
  input?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
};

export type TextInputShortcut = string | TextInputKeyBinding;

export type TextInputOptions = {
  submitOn?: TextInputShortcut[];
  newlineOn?: TextInputShortcut[];
  historyPrevOn?: TextInputShortcut[];
  backslashNewline?: boolean;
  bracketedPaste?: boolean;
  normalizePasteNewlines?: boolean;
  maxUndo?: number;
  tabText?: string | false;
};

export type TextInputConfig = {
  placeholder?: string;
  placeholderColor?: string;
  options: TextInputOptions;
};

export type MessageRole = "user" | "assistant" | "thinking" | "tool" | "system" | "meta";

export type MessageStyle = {
  prefix: string;
  color?: string;
  dim?: boolean;
  bold?: boolean;
};

export type MessageConfig = {
  roles: Record<MessageRole, MessageStyle>;
  empty: string;
  closeHint: string;
  scrollHint: string;
};

export type LoadingConfig = {
  labels: string[];
  frames: string[];
  suffix: string;
  statusSeparator: string;
  elapsedLabel: (seconds: number) => string;
  queuedLabel: (count: number) => string;
};

export type VibeConfig = {
  theme: VibeTheme;
  textInput: TextInputConfig;
  messages: MessageConfig;
  loading: LoadingConfig;
  highlight: {
    theme: HighlightTheme;
  };
};

export type VibeConfigInput = {
  theme?: VibeThemeInput;
  textInput?: Partial<Omit<TextInputConfig, "options">> & {
    options?: TextInputOptions;
  };
  messages?: Partial<Omit<MessageConfig, "roles">> & {
    roles?: Partial<Record<MessageRole, Partial<MessageStyle>>>;
  };
  loading?: Partial<LoadingConfig>;
  highlight?: {
    theme?: Partial<HighlightTheme>;
  };
};

export const defaultTheme: VibeTheme = {
  colors: {
    accent: "#ff6ac1",
    muted: "gray",
    success: "#4ade80",
    warning: "#facc15",
    error: "#fb7185",
    placeholder: "gray",
  },
  gradient: {
    hueStart: 295,
    hueSpan: 60,
    phaseSpeed: 2,
    saturation: 0.9,
    lightness: 0.68,
  },
};

export const defaultHighlightTheme: HighlightTheme = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  undim: "\x1b[22m",
  keyword: "\x1b[35m",
  string: "\x1b[32m",
  number: "\x1b[33m",
  comment: "\x1b[2;37m",
  commentOff: "\x1b[22;39m",
};

export const defaultVibeConfig: VibeConfig = {
  theme: defaultTheme,
  textInput: {
    options: {
      submitOn: ["return"],
      newlineOn: ["shift+return", "meta+return", "ctrl+return"],
      historyPrevOn: ["up", "meta+up"],
      backslashNewline: true,
      bracketedPaste: true,
      normalizePasteNewlines: true,
      maxUndo: 200,
      tabText: "  ",
    },
  },
  messages: {
    roles: {
      user: { prefix: "> ", color: "cyan" },
      assistant: { prefix: "* ", color: "#ff6ac1" },
      thinking: { prefix: ". ", color: "gray", dim: true },
      tool: { prefix: "$ ", color: "gray", dim: true },
      system: { prefix: "", color: "magenta" },
      meta: { prefix: "* ", color: "gray", dim: true },
    },
    empty: "(empty)",
    closeHint: "Enter/Esc close",
    scrollHint: "up/down scroll",
  },
  loading: {
    labels: ["Working"],
    frames: ["-", "\\", "|", "/"],
    suffix: "...",
    statusSeparator: " - ",
    elapsedLabel: (seconds) => `${seconds}s`,
    queuedLabel: (count) => `queued ${count}`,
  },
  highlight: {
    theme: defaultHighlightTheme,
  },
};

const VibeConfigContext = React.createContext<VibeConfig>(defaultVibeConfig);

export type VibeConfigProviderProps = {
  config?: VibeConfigInput;
  children: React.ReactNode;
};

export function createTheme(input: VibeThemeInput = {}, base: VibeTheme = defaultTheme): VibeTheme {
  return {
    colors: {
      ...base.colors,
      ...input.colors,
    },
    gradient: {
      ...base.gradient,
      ...input.gradient,
    },
  };
}

export function mergeTextInputOptions(
  input: TextInputOptions | undefined,
  base: TextInputOptions = defaultVibeConfig.textInput.options,
): TextInputOptions {
  return {
    ...base,
    ...input,
  };
}

function createMessageConfig(input: VibeConfigInput["messages"] | undefined, base: MessageConfig): MessageConfig {
  const roles = { ...base.roles };
  for (const role of Object.keys(input?.roles ?? {}) as MessageRole[]) {
    roles[role] = {
      ...base.roles[role],
      ...input?.roles?.[role],
    };
  }
  return {
    ...base,
    ...input,
    roles,
  };
}

export function createVibeConfig(input: VibeConfigInput = {}, base: VibeConfig = defaultVibeConfig): VibeConfig {
  return {
    theme: createTheme(input.theme, base.theme),
    textInput: {
      ...base.textInput,
      ...input.textInput,
      options: mergeTextInputOptions(input.textInput?.options, base.textInput.options),
    },
    messages: createMessageConfig(input.messages, base.messages),
    loading: {
      ...base.loading,
      ...input.loading,
    },
    highlight: {
      theme: {
        ...base.highlight.theme,
        ...input.highlight?.theme,
      },
    },
  };
}

export function VibeConfigProvider({ config, children }: VibeConfigProviderProps) {
  const parent = React.useContext(VibeConfigContext);
  const value = React.useMemo(() => createVibeConfig(config, parent), [config, parent]);
  return <VibeConfigContext.Provider value={value}>{children}</VibeConfigContext.Provider>;
}

export function useVibeConfig(config?: VibeConfigInput): VibeConfig {
  const parent = React.useContext(VibeConfigContext);
  return React.useMemo(() => createVibeConfig(config, parent), [config, parent]);
}

export function loadingLabelAt(config: Pick<LoadingConfig, "labels">, index: number): string {
  if (config.labels.length === 0) return "";
  return config.labels[Math.abs(index) % config.labels.length]!;
}

export function loadingFrameAt(config: Pick<LoadingConfig, "frames">, index: number): string {
  if (config.frames.length === 0) return "";
  return config.frames[Math.abs(index) % config.frames.length]!;
}

export function formatLoadingStatus(
  config: LoadingConfig,
  opts: {
    seconds?: number;
    status?: string;
    queued?: number;
  } = {},
): string {
  const parts: string[] = [];
  if (opts.seconds !== undefined) parts.push(config.elapsedLabel(opts.seconds));
  if (opts.status) parts.push(opts.status);
  if (opts.queued && opts.queued > 0) parts.push(config.queuedLabel(opts.queued));
  return parts.join(config.statusSeparator);
}
