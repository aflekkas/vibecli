import type { GradientConfig, MessageRole, MessageStyle, VibeConfigInput } from "./ui-config.tsx";

export type DefineThemeInput = {
  accent: string;
  secondary?: string;
  muted?: string;
  success?: string;
  warning?: string;
  error?: string;
  placeholder?: string;
  gradient?: Partial<GradientConfig>;
  roles?: Partial<Record<MessageRole, Partial<MessageStyle>>>;
};

function hexToHue(input: string): number | null {
  const m = input.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  const r = parseInt(m[1]!, 16) / 255;
  const g = parseInt(m[2]!, 16) / 255;
  const b = parseInt(m[3]!, 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function defineTheme(input: DefineThemeInput): VibeConfigInput {
  const accent = input.accent;
  const derivedHue = hexToHue(accent);
  const gradient: GradientConfig = {
    hueStart: derivedHue ?? 0,
    hueSpan: 60,
    phaseSpeed: 2,
    saturation: derivedHue === null ? 0 : 0.9,
    lightness: 0.68,
    ...input.gradient,
  };
  const userColor = input.secondary ?? "cyan";
  const baseRoles: Record<MessageRole, MessageStyle> = {
    user: { prefix: "> ", color: userColor },
    assistant: { prefix: "* ", color: accent },
    thinking: { prefix: ". ", color: input.muted ?? "gray", dim: true },
    tool: { prefix: "$ ", color: input.muted ?? "gray", dim: true },
    system: { prefix: "", color: accent },
    meta: { prefix: "* ", color: input.muted ?? "gray", dim: true },
  };
  const mergedRoles = { ...baseRoles };
  for (const role of Object.keys(input.roles ?? {}) as MessageRole[]) {
    mergedRoles[role] = { ...baseRoles[role], ...input.roles?.[role] };
  }
  return {
    theme: {
      colors: {
        accent,
        muted: input.muted ?? "gray",
        success: input.success ?? "#4ade80",
        warning: input.warning ?? "#facc15",
        error: input.error ?? "#fb7185",
        placeholder: input.placeholder ?? "gray",
      },
      gradient,
    },
    messages: { roles: mergedRoles },
  };
}

export const themes = {
  pink: defineTheme({
    accent: "#ff6ac1",
    secondary: "cyan",
    gradient: { hueStart: 295, hueSpan: 60 },
  }),
  ocean: defineTheme({
    accent: "#38bdf8",
    secondary: "#a78bfa",
    gradient: { hueSpan: 120, saturation: 0.82, lightness: 0.62 },
  }),
  matrix: defineTheme({
    accent: "#22c55e",
    secondary: "#86efac",
    placeholder: "#166534",
    gradient: { hueSpan: 40, saturation: 0.85, lightness: 0.55 },
  }),
  amber: defineTheme({
    accent: "#f59e0b",
    secondary: "#fde68a",
    gradient: { hueSpan: 50, saturation: 0.95, lightness: 0.6 },
  }),
  claude: defineTheme({
    accent: "#cc785c",
    secondary: "#d97757",
    gradient: { hueSpan: 30, saturation: 0.6, lightness: 0.62 },
  }),
  mono: defineTheme({
    accent: "#e5e5e5",
    secondary: "white",
    muted: "gray",
    placeholder: "gray",
    gradient: { hueStart: 0, hueSpan: 0, saturation: 0, lightness: 0.85 },
  }),
} as const;

export type ThemeName = keyof typeof themes;

export const themeNames = Object.keys(themes) as ThemeName[];

export function isThemeName(value: string): value is ThemeName {
  return (themeNames as readonly string[]).includes(value);
}
