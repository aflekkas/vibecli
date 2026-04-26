import React from "react";
import { Box, Text } from "ink";
import {
  createTheme,
  defaultTheme,
  useVibeConfig,
  type GradientConfig,
  type VibeConfigInput,
  type VibeTheme,
  type VibeThemeInput,
} from "./ui-config.tsx";

export {
  createTheme,
  createVibeConfig,
  defaultHighlightTheme,
  defaultTheme,
  defaultVibeConfig,
  formatLoadingStatus,
  loadingFrameAt,
  loadingLabelAt,
  mergeTextInputOptions,
  useVibeConfig,
  VibeConfigProvider,
} from "./ui-config.tsx";
export type {
  LoadingConfig,
  MessageConfig,
  MessageRole,
  MessageStyle,
  TextInputConfig,
  TextInputKeyBinding,
  TextInputOptions,
  TextInputShortcut,
  TextInputSpecialKey,
  VibeConfig,
  VibeConfigInput,
  VibeConfigProviderProps,
  GradientConfig,
  VibeTheme,
  VibeThemeInput,
} from "./ui-config.tsx";

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((p) => p.toString(16).padStart(2, "0")).join("")}`;
}

export function hslToRgb(hue: number, saturation: number, lightness: number) {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hh = hue / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = lightness - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rainbowColorAt(ratio: number, phase: number): string {
  const hue = (phase * 14 + ratio * 220) % 360;
  const { r, g, b } = hslToRgb(hue, 0.95, 0.62);
  return rgbToHex(r, g, b);
}

export function gradientColorAt(
  ratio: number,
  phase: number = 0,
  gradient: GradientConfig = defaultTheme.gradient,
): string {
  const hue =
    gradient.hueStart +
    (((gradient.phaseSpeed ?? 0) * phase + ratio * gradient.hueSpan) % 360);
  const { r, g, b } = hslToRgb(
    hue,
    gradient.saturation ?? defaultTheme.gradient.saturation!,
    gradient.lightness ?? defaultTheme.gradient.lightness!,
  );
  return rgbToHex(r, g, b);
}

export function pinkGradientAt(ratio: number, phase: number = 0): string {
  return gradientColorAt(ratio, phase, defaultTheme.gradient);
}

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const out: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      if (!current) current = word;
      else if (current.length + 1 + word.length <= width) current += " " + word;
      else {
        out.push(current);
        current = word;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

export type GradientTextProps = {
  text: string;
  phase?: number;
  config?: VibeConfigInput;
  theme?: VibeThemeInput;
  gradient?: Partial<GradientConfig>;
  colorAt?: (opts: { char: string; index: number; ratio: number; phase: number; theme: VibeTheme }) => string;
};

export function GradientText({ text, phase = 0, config, theme, gradient, colorAt }: GradientTextProps) {
  const vibeConfig = useVibeConfig(config);
  const resolvedTheme = createTheme({
    ...theme,
    gradient: {
      ...theme?.gradient,
      ...gradient,
    },
  }, vibeConfig.theme);
  const chars = text.split("");
  return (
    <Box>
      {chars.map((char, index) => {
        const ratio = chars.length <= 1 ? 0 : index / (chars.length - 1);
        const color = colorAt
          ? colorAt({ char, index, ratio, phase, theme: resolvedTheme })
          : gradientColorAt(ratio, phase, resolvedTheme.gradient);
        return (
          <Text key={`${char}-${index}`} color={color}>
            {char}
          </Text>
        );
      })}
    </Box>
  );
}
