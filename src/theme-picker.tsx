import React from "react";
import { Box, Text, useInput } from "ink";
import { themes, themeNames, type ThemeName } from "./themes.ts";

export type ThemePickerProps = {
  value?: ThemeName;
  onPick: (name: ThemeName) => void;
  onCancel?: () => void;
  options?: ThemeName[];
  swatch?: string;
  hint?: string;
};

export function ThemePicker({
  value,
  onPick,
  onCancel,
  options,
  swatch = "■■■",
  hint = "↑/↓ choose, enter pick, esc cancel",
}: ThemePickerProps) {
  const names = options ?? themeNames;
  const initial = React.useMemo(() => {
    if (!value) return 0;
    const i = names.indexOf(value);
    return i >= 0 ? i : 0;
  }, [value, names]);
  const [index, setIndex] = React.useState(initial);

  useInput((_input, key) => {
    if (key.upArrow) setIndex((i) => (i - 1 + names.length) % names.length);
    else if (key.downArrow) setIndex((i) => (i + 1) % names.length);
    else if (key.return) onPick(names[index]!);
    else if (key.escape && onCancel) onCancel();
  });

  return (
    <Box flexDirection="column">
      {names.map((name, i) => {
        const config = themes[name];
        const accent = config.theme?.colors?.accent ?? "white";
        const secondary = config.messages?.roles?.user?.color ?? accent;
        const selected = i === index;
        return (
          <Box key={name}>
            <Text color={accent}>{selected ? "› " : "  "}</Text>
            <Text color={accent} bold={selected}>
              {name.padEnd(8)}
            </Text>
            <Text color={accent}>{swatch}</Text>
            <Text color={secondary}>{swatch}</Text>
          </Box>
        );
      })}
      {hint ? (
        <Box marginTop={1}>
          <Text color="gray">{hint}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
