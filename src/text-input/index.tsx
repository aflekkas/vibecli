import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { Key } from "ink";
import { createTheme, mergeTextInputOptions, useVibeConfig } from "../ui-config.tsx";
import { nextCharLen, prevCharLen, wordEnd, wordStart } from "./cursor.ts";
import { findPasteEnd, PASTE_START } from "./paste.ts";
import type { TextInputKeyBinding, TextInputProps, TextInputShortcut } from "./types.ts";

const DEFAULT_SUBMIT_ON: TextInputShortcut[] = ["return"];
const DEFAULT_NEWLINE_ON: TextInputShortcut[] = ["shift+return", "meta+return", "ctrl+return"];
const DEFAULT_HISTORY_PREV_ON: TextInputShortcut[] = ["up", "meta+up"];

type TextInputKeyEvent = {
  input: string;
  name: string | null;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

function normalizeKeyName(key: string): string {
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

function keyNameFor(key: Key): string | null {
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

function modifiedReturnEvent(input: string): TextInputKeyEvent | null {
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

function textInputKeyEvent(input: string, key: Key): TextInputKeyEvent {
  return {
    input,
    name: keyNameFor(key),
    ctrl: key.ctrl,
    meta: key.meta,
    shift: key.shift,
  };
}

function modifiersMatch(
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

function bindingMatches(event: TextInputKeyEvent, binding: TextInputShortcut): boolean {
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

function matchesAny(event: TextInputKeyEvent, bindings: TextInputShortcut[]): boolean {
  return bindings.some((binding) => bindingMatches(event, binding));
}

function normalizePastedText(text: string, normalizePasteNewlines: boolean): string {
  return normalizePasteNewlines ? text.replace(/\r\n?/g, "\n") : text;
}

export function TextInput({
  value,
  onChange,
  onSubmit,
  onHistoryPrev,
  placeholder,
  placeholderColor,
  config,
  theme,
  focus = true,
  maxUndo,
  tabText,
  options,
}: TextInputProps) {
  const vibeConfig = useVibeConfig(config);
  const resolvedTheme = createTheme(theme, vibeConfig.theme);
  const localOptions = { ...(options ?? {}) };
  if (localOptions.maxUndo === undefined && maxUndo !== undefined) localOptions.maxUndo = maxUndo;
  if (localOptions.tabText === undefined && tabText !== undefined) localOptions.tabText = tabText;
  const resolvedOptions = mergeTextInputOptions(localOptions, vibeConfig.textInput.options);
  const resolvedMaxUndo = resolvedOptions.maxUndo ?? 200;
  const resolvedTabText = resolvedOptions.tabText ?? "  ";
  const submitOn = resolvedOptions.submitOn ?? DEFAULT_SUBMIT_ON;
  const newlineOn = resolvedOptions.newlineOn ?? DEFAULT_NEWLINE_ON;
  const historyPrevOn = resolvedOptions.historyPrevOn ?? DEFAULT_HISTORY_PREV_ON;
  const backslashNewline = resolvedOptions.backslashNewline ?? true;
  const bracketedPaste = resolvedOptions.bracketedPaste ?? true;
  const normalizePasteNewlines = resolvedOptions.normalizePasteNewlines ?? true;
  const newlineFirst = options?.newlineOn !== undefined;
  const resolvedPlaceholder = placeholder ?? vibeConfig.textInput.placeholder;
  const resolvedPlaceholderColor =
    placeholderColor ?? vibeConfig.textInput.placeholderColor ?? resolvedTheme.colors.placeholder;
  const [cursor, setCursor] = React.useState(value.length);
  const { stdout } = useStdout();
  const undoStack = React.useRef<{ value: string; cursor: number }[]>([]);
  const redoStack = React.useRef<{ value: string; cursor: number }[]>([]);
  const pasteBuf = React.useRef<string | null>(null);

  // Enable bracketed paste mode for the lifetime of this input.
  React.useEffect(() => {
    if (!focus || !bracketedPaste) return;
    stdout?.write("\x1b[?2004h");
    return () => {
      stdout?.write("\x1b[?2004l");
    };
  }, [bracketedPaste, focus, stdout]);

  // Keep cursor in bounds if value shrinks from outside.
  React.useEffect(() => {
    if (cursor > value.length) setCursor(value.length);
  }, [value, cursor]);

  const pushUndo = React.useCallback((v: string, c: number) => {
    undoStack.current.push({ value: v, cursor: c });
    if (resolvedMaxUndo > 0) {
      while (undoStack.current.length > resolvedMaxUndo) undoStack.current.shift();
    } else {
      undoStack.current = [];
    }
    redoStack.current = [];
  }, [resolvedMaxUndo]);

  const commit = React.useCallback(
    (newValue: string, newCursor: number) => {
      pushUndo(value, cursor);
      onChange(newValue);
      setCursor(newCursor);
    },
    [value, cursor, onChange, pushUndo],
  );

  const insertText = React.useCallback(
    (text: string) => {
      commit(value.slice(0, cursor) + text + value.slice(cursor), cursor + text.length);
    },
    [value, cursor, commit],
  );

  const handleSubmitOrNewline = React.useCallback(
    (event: TextInputKeyEvent) => {
      if (newlineFirst && matchesAny(event, newlineOn)) {
        insertText("\n");
        return true;
      }
      if (
        backslashNewline &&
        event.name === "return" &&
        !event.ctrl &&
        !event.meta &&
        !event.shift &&
        cursor > 0 &&
        value[cursor - 1] === "\\"
      ) {
        commit(value.slice(0, cursor - 1) + "\n" + value.slice(cursor), cursor);
        return true;
      }
      if (matchesAny(event, submitOn)) {
        onSubmit?.(value);
        return true;
      }
      if (matchesAny(event, newlineOn)) {
        insertText("\n");
        return true;
      }
      return false;
    },
    [backslashNewline, commit, cursor, insertText, newlineFirst, newlineOn, onSubmit, submitOn, value],
  );

  useInput(
    (input, key) => {
      // A paste arrives as `\x1b[200~...content...\x1b[201~`. Ink strips the
      // leading ESC, so input begins with `[200~`.
      if (bracketedPaste && pasteBuf.current !== null) {
        const end = findPasteEnd(input);
        if (end) {
          pasteBuf.current += input.slice(0, end.index);
          const body = normalizePastedText(pasteBuf.current, normalizePasteNewlines);
          pasteBuf.current = null;
          const remainder = input.slice(end.index + end.length);
          const total = body + remainder;
          commit(value.slice(0, cursor) + total + value.slice(cursor), cursor + total.length);
          return;
        }
        pasteBuf.current += input;
        return;
      }

      if (bracketedPaste && input.startsWith(PASTE_START)) {
        const body = input.slice(PASTE_START.length);
        const end = findPasteEnd(body);
        if (end) {
          insertText(normalizePastedText(body.slice(0, end.index), normalizePasteNewlines));
          return;
        }
        pasteBuf.current = body;
        return;
      }

      const modEnter = modifiedReturnEvent(input);
      if (modEnter) {
        handleSubmitOrNewline(modEnter);
        return;
      }

      const event = textInputKeyEvent(input, key);

      if (key.ctrl && input === "z") {
        const prev = undoStack.current.pop();
        if (!prev) return;
        redoStack.current.push({ value, cursor });
        onChange(prev.value);
        setCursor(prev.cursor);
        return;
      }
      if (key.ctrl && input === "y") {
        const next = redoStack.current.pop();
        if (!next) return;
        undoStack.current.push({ value, cursor });
        onChange(next.value);
        setCursor(next.cursor);
        return;
      }

      if (key.return) {
        handleSubmitOrNewline(event);
        return;
      }

      // Ink reports the physical Backspace key (`\x7f`) as `key.delete`, not
      // `key.backspace`. Forward-delete (`\x1b[3~`) also arrives as
      // `key.delete` and ink doesn't expose enough info to distinguish them,
      // so both behave as backward-delete here. Ctrl+H (`\b`) → `key.backspace`.
      if (key.backspace || key.delete) {
        if (key.meta || (key.ctrl && input === "w")) {
          const start = wordStart(value, cursor);
          if (start === cursor) return;
          commit(value.slice(0, start) + value.slice(cursor), start);
          return;
        }
        if (cursor === 0) return;
        const back = prevCharLen(value, cursor);
        commit(value.slice(0, cursor - back) + value.slice(cursor), cursor - back);
        return;
      }

      if (key.ctrl && input === "w") {
        const start = wordStart(value, cursor);
        if (start === cursor) return;
        commit(value.slice(0, start) + value.slice(cursor), start);
        return;
      }
      if (key.ctrl && input === "u") {
        const before = value.slice(0, cursor);
        const lineStart = before.lastIndexOf("\n") + 1;
        if (lineStart === cursor) {
          if (cursor === 0) return;
          commit(value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1);
          return;
        }
        commit(value.slice(0, lineStart) + value.slice(cursor), lineStart);
        return;
      }
      if (key.ctrl && input === "k") {
        const nextNl = value.indexOf("\n", cursor);
        const lineEnd = nextNl === -1 ? value.length : nextNl;
        if (lineEnd === cursor) return;
        commit(value.slice(0, cursor) + value.slice(lineEnd), cursor);
        return;
      }

      if (key.leftArrow) {
        if (key.meta || key.ctrl) setCursor(wordStart(value, cursor));
        else if (cursor > 0) setCursor(cursor - prevCharLen(value, cursor));
        return;
      }
      if (key.rightArrow) {
        if (key.meta || key.ctrl) setCursor(wordEnd(value, cursor));
        else if (cursor < value.length) setCursor(cursor + nextCharLen(value, cursor));
        return;
      }
      if (key.ctrl && input === "a") {
        setCursor(value.slice(0, cursor).lastIndexOf("\n") + 1);
        return;
      }
      if (key.ctrl && input === "e") {
        const nextNl = value.indexOf("\n", cursor);
        setCursor(nextNl === -1 ? value.length : nextNl);
        return;
      }

      if (key.upArrow) {
        if (key.meta) {
          if (cursor === 0 && matchesAny(event, historyPrevOn)) onHistoryPrev?.();
          else setCursor(0);
          return;
        }
        const before = value.slice(0, cursor);
        const curLineStart = before.lastIndexOf("\n") + 1;
        if (curLineStart === 0) {
          if (matchesAny(event, historyPrevOn)) onHistoryPrev?.();
          return;
        }
        const col = cursor - curLineStart;
        const prevLineEnd = curLineStart - 1;
        const prevLineStart = before.lastIndexOf("\n", prevLineEnd - 1) + 1;
        const prevLineLen = prevLineEnd - prevLineStart;
        setCursor(prevLineStart + Math.min(col, prevLineLen));
        return;
      }
      if (key.downArrow) {
        if (key.meta) {
          setCursor(value.length);
          return;
        }
        const curLineStart = value.slice(0, cursor).lastIndexOf("\n") + 1;
        const col = cursor - curLineStart;
        const nextNl = value.indexOf("\n", cursor);
        if (nextNl === -1) return;
        const nextLineStart = nextNl + 1;
        const nextNlAfter = value.indexOf("\n", nextLineStart);
        const nextLineEnd = nextNlAfter === -1 ? value.length : nextNlAfter;
        const nextLineLen = nextLineEnd - nextLineStart;
        setCursor(nextLineStart + Math.min(col, nextLineLen));
        return;
      }

      if (key.tab) {
        if (resolvedTabText !== false) insertText(resolvedTabText);
        return;
      }
      if (key.escape) return;
      if (key.ctrl || key.meta) return;

      if (input && input.length > 0) {
        insertText(input);
      }
    },
    { isActive: focus },
  );

  if (!value) {
    return (
      <Box>
        <Text inverse> </Text>
        {resolvedPlaceholder ? (
          <Text color={resolvedPlaceholderColor}>{resolvedPlaceholder}</Text>
        ) : null}
      </Box>
    );
  }

  const before = value.slice(0, cursor);
  const at = value[cursor] ?? " ";
  const after = value.slice(cursor + 1);
  return (
    <Text>
      {before}
      <Text inverse>{at === "\n" ? " " : at}</Text>
      {at === "\n" ? "\n" : null}
      {after}
    </Text>
  );
}
