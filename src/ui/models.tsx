import React from "react";
import { Box, Text, useInput } from "ink";
import { useVibeConfig } from "./ui-config.tsx";
import type { Provider } from "../providers/types.ts";

export type ModelEntry = {
  id: string;
  providerName: string;
  build: () => Provider;
};

/**
 * Identity helper for type inference when authoring a model registry array.
 * Lets callers write `defineModel({ id, providerName, build })` and get
 * autocomplete on each field.
 */
export function defineModel(entry: ModelEntry): ModelEntry {
  return entry;
}

export type ModelPickerProps = {
  models: ModelEntry[];
  value: string;
  onPick: (id: string) => void;
  onCancel: () => void;
  hint?: string;
  labelWidth?: number;
};

/**
 * Inline model switcher with arrow-key navigation. Renders one row per entry:
 * id (left, accent) + providerName (right, muted). Calls `onPick` with the
 * chosen id on Enter, `onCancel` on Escape. Pulls colors from `useVibeConfig`.
 */
export function ModelPicker({
  models,
  value,
  onPick,
  onCancel,
  hint = "↑/↓ choose, enter pick, esc cancel",
  labelWidth,
}: ModelPickerProps) {
  const config = useVibeConfig();
  const accent = config.theme.colors.accent;
  const muted = config.theme.colors.muted;
  const initial = React.useMemo(
    () => Math.max(0, models.findIndex((m) => m.id === value)),
    [value, models],
  );
  const [index, setIndex] = React.useState(initial);
  const width =
    labelWidth ?? Math.max(8, ...models.map((m) => m.id.length)) + 2;

  useInput((_input, key) => {
    if (models.length === 0) {
      if (key.escape) onCancel();
      return;
    }
    if (key.upArrow) setIndex((i) => (i - 1 + models.length) % models.length);
    else if (key.downArrow) setIndex((i) => (i + 1) % models.length);
    else if (key.return) onPick(models[index]!.id);
    else if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column">
      {models.map((m, i) => {
        const selected = i === index;
        return (
          <Box key={m.id}>
            <Text color={accent}>{selected ? "› " : "  "}</Text>
            <Text color={accent} bold={selected}>
              {m.id.padEnd(width)}
            </Text>
            <Text color={muted}>{m.providerName}</Text>
          </Box>
        );
      })}
      {hint ? (
        <Box marginTop={1}>
          <Text color={muted}>{hint}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
