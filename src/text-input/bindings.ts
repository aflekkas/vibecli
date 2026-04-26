// Key-binding matching for <TextInput>. Supports structured bindings
// (`{ key, ctrl, meta, shift }`) and ergonomic strings ("ctrl+a", "cmd+z").
// Modifier semantics: an unset modifier in the binding means "must be absent"
// when no modifier is required, which prevents "a" from matching "ctrl+a".
import type { TextInputKeyBinding, TextInputShortcut } from "./types.ts";
import { normalizeKeyName, type TextInputKeyEvent } from "./keys.ts";

export function modifiersMatch(
  event: TextInputKeyEvent,
  expected: Pick<TextInputKeyBinding, "ctrl" | "meta" | "shift">,
): boolean {
  const hasExpectedModifier = expected.ctrl === true || expected.meta === true || expected.shift === true;
  if (!hasExpectedModifier) return !event.ctrl && !event.meta && !event.shift;
  if (expected.ctrl === true && !event.ctrl) return false;
  if (expected.meta === true && !event.meta) return false;
  if (expected.shift === true && !event.shift) return false;
  if (expected.ctrl === false && event.ctrl) return false;
  if (expected.meta === false && event.meta) return false;
  if (expected.shift === false && event.shift) return false;
  return true;
}

export function bindingMatches(event: TextInputKeyEvent, binding: TextInputShortcut): boolean {
  if (typeof binding === "string") {
    const parts = binding.split("+").map((part) => part.trim()).filter(Boolean);
    const key = normalizeKeyName(parts.pop() ?? "");
    const modifiers = new Set(parts.map((part) => normalizeKeyName(part)));
    const parsed: TextInputKeyBinding = { key };
    if (modifiers.has("ctrl") || modifiers.has("control")) parsed.ctrl = true;
    if (
      modifiers.has("meta") ||
      modifiers.has("cmd") ||
      modifiers.has("command") ||
      modifiers.has("alt") ||
      modifiers.has("option")
    ) {
      parsed.meta = true;
    }
    if (modifiers.has("shift")) parsed.shift = true;
    return bindingMatches(event, parsed);
  }

  const key = binding.key ? normalizeKeyName(binding.key) : null;
  const input = binding.input;
  const keyMatches =
    key === null ||
    event.name === key ||
    (key.length === 1 && event.input.toLowerCase() === key);
  const inputMatches = input === undefined || event.input === input;
  return keyMatches && inputMatches && modifiersMatch(event, binding);
}

export function matchesAny(event: TextInputKeyEvent, bindings: TextInputShortcut[]): boolean {
  return bindings.some((binding) => bindingMatches(event, binding));
}
