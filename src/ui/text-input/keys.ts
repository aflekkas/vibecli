// Normalizes Ink's key events into a single shape with stable names.
// Ink reports special keys as boolean flags (key.upArrow, key.delete)
// and modified Return as a raw escape sequence (`\x1b[27;<mod>;13~`),
// neither of which is convenient to bind against. This module collapses
// both into `{ name, input, ctrl, meta, shift }` so bindings.ts can compare.
import type { Key } from "ink";

export type TextInputKeyEvent = {
  input: string;
  name: string | null;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

export function normalizeKeyName(key: string): string {
  const normalized = key.trim().toLowerCase();
  if (normalized === "enter") return "return";
  if (normalized === "uparrow") return "up";
  if (normalized === "downarrow") return "down";
  if (normalized === "leftarrow") return "left";
  if (normalized === "rightarrow") return "right";
  if (normalized === "esc") return "escape";
  if (normalized === "del") return "delete";
  return normalized;
}

export function keyNameFor(key: Key): string | null {
  if (key.return) return "return";
  if (key.tab) return "tab";
  if (key.escape) return "escape";
  if (key.upArrow) return "up";
  if (key.downArrow) return "down";
  if (key.leftArrow) return "left";
  if (key.rightArrow) return "right";
  if (key.backspace) return "backspace";
  if (key.delete) return "delete";
  return null;
}

export function modifiedReturnEvent(input: string): TextInputKeyEvent | null {
  const match = /^\[27;(\d+);13~$/.exec(input);
  if (!match) return null;
  const mod = Number(match[1]);
  return {
    input,
    name: "return",
    shift: mod === 2 || mod === 4 || mod === 6 || mod === 8,
    meta: mod === 3 || mod === 4 || mod === 7 || mod === 8,
    ctrl: mod === 5 || mod === 6 || mod === 7 || mod === 8,
  };
}

export function textInputKeyEvent(input: string, key: Key): TextInputKeyEvent {
  return {
    input,
    name: keyNameFor(key),
    ctrl: key.ctrl,
    meta: key.meta,
    shift: key.shift,
  };
}
