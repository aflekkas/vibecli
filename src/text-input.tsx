import React from "react";
import { Box, Text, useInput, useStdout } from "ink";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  onHistoryPrev?: () => void;
  placeholder?: string;
  focus?: boolean;
};

// Find the start of the previous word from index i (exclusive).
// Word = run of non-whitespace, preceded by whitespace.
function wordStart(s: string, i: number): number {
  let j = i;
  while (j > 0 && /\s/.test(s[j - 1]!)) j--;
  while (j > 0 && !/\s/.test(s[j - 1]!)) j--;
  return j;
}

function wordEnd(s: string, i: number): number {
  let j = i;
  while (j < s.length && /\s/.test(s[j]!)) j++;
  while (j < s.length && !/\s/.test(s[j]!)) j++;
  return j;
}

const segmenter =
  typeof Intl !== "undefined" && typeof (Intl as any).Segmenter === "function"
    ? new (Intl as any).Segmenter(undefined, { granularity: "grapheme" })
    : null;

// Length of the grapheme cluster ending at index i. Falls back to UTF-16 surrogate pairs.
function prevCharLen(s: string, i: number): number {
  if (i <= 0) return 0;
  if (segmenter) {
    let lastLen = 1;
    for (const { segment } of segmenter.segment(s.slice(0, i))) {
      lastLen = segment.length;
    }
    return lastLen;
  }
  const c = s.charCodeAt(i - 1);
  if (c >= 0xdc00 && c <= 0xdfff && i >= 2) return 2;
  return 1;
}

// Length of the grapheme cluster starting at index i.
function nextCharLen(s: string, i: number): number {
  if (i >= s.length) return 0;
  if (segmenter) {
    for (const { segment } of segmenter.segment(s.slice(i))) {
      return segment.length;
    }
  }
  const c = s.charCodeAt(i);
  if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) return 2;
  return 1;
}

const PASTE_START = "[200~";
const PASTE_END_WITH_ESC = "\x1b[201~";
const PASTE_END_BARE = "[201~";

export function TextInput({
  value,
  onChange,
  onSubmit,
  onHistoryPrev,
  placeholder,
  focus = true,
}: Props) {
  const [cursor, setCursor] = React.useState(value.length);
  const { stdout } = useStdout();
  const undoStack = React.useRef<{ value: string; cursor: number }[]>([]);
  const redoStack = React.useRef<{ value: string; cursor: number }[]>([]);
  const pasteBuf = React.useRef<string | null>(null);

  // Enable bracketed paste mode for the lifetime of this input.
  React.useEffect(() => {
    if (!focus) return;
    stdout?.write("\x1b[?2004h");
    return () => {
      stdout?.write("\x1b[?2004l");
    };
  }, [focus, stdout]);

  // Keep cursor in bounds if value shrinks from outside.
  React.useEffect(() => {
    if (cursor > value.length) setCursor(value.length);
  }, [value, cursor]);

  const pushUndo = React.useCallback(
    (v: string, c: number) => {
      undoStack.current.push({ value: v, cursor: c });
      if (undoStack.current.length > 200) undoStack.current.shift();
      redoStack.current = [];
    },
    [],
  );

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

  useInput(
    (input, key) => {
      // --- bracketed paste handling ---
      // A paste arrives as `\x1b[200~...content...\x1b[201~`. Ink strips the
      // leading ESC, so input begins with `[200~`. Body may contain another
      // ESC before `[201~` (preserved by ink).
      if (pasteBuf.current !== null) {
        let chunk = input;
        const endEsc = chunk.indexOf(PASTE_END_WITH_ESC);
        const endBare = chunk.indexOf(PASTE_END_BARE);
        let endIdx = -1;
        let endLen = 0;
        if (endEsc >= 0) {
          endIdx = endEsc;
          endLen = PASTE_END_WITH_ESC.length;
        } else if (endBare >= 0) {
          endIdx = endBare;
          endLen = PASTE_END_BARE.length;
        }
        if (endIdx >= 0) {
          pasteBuf.current += chunk.slice(0, endIdx);
          const body = pasteBuf.current.replace(/\r\n?/g, "\n");
          pasteBuf.current = null;
          const remainder = chunk.slice(endIdx + endLen);
          const total = body + remainder;
          commit(value.slice(0, cursor) + total + value.slice(cursor), cursor + total.length);
          return;
        }
        pasteBuf.current += chunk;
        return;
      }
      if (input.startsWith(PASTE_START)) {
        const body = input.slice(PASTE_START.length);
        const endEsc = body.indexOf(PASTE_END_WITH_ESC);
        const endBare = body.indexOf(PASTE_END_BARE);
        let endIdx = -1;
        let endLen = 0;
        if (endEsc >= 0) {
          endIdx = endEsc;
          endLen = PASTE_END_WITH_ESC.length;
        } else if (endBare >= 0) {
          endIdx = endBare;
          endLen = PASTE_END_BARE.length;
        }
        if (endIdx >= 0) {
          const text = body.slice(0, endIdx).replace(/\r\n?/g, "\n");
          insertText(text);
          // ignore trailing text after paste end (rare); Ghostty doesn't emit any.
          void endLen;
          return;
        }
        // paste split across chunks — buffer until end marker arrives
        pasteBuf.current = body;
        return;
      }

      // xterm modifyOtherKeys: shift/ctrl/alt + enter arrives as `\x1b[27;<mod>;13~`.
      // Ink strips the leading ESC, so `input` shows up as `[27;<mod>;13~`.
      const modEnter = /^\[27;(\d+);13~$/.exec(input);
      if (modEnter) {
        const mod = Number(modEnter[1]);
        if (mod === 1) onSubmit?.(value);
        else insertText("\n");
        return;
      }

      // --- undo / redo ---
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
        if (key.shift || key.meta) {
          insertText("\n");
          return;
        }
        if (cursor > 0 && value[cursor - 1] === "\\") {
          commit(value.slice(0, cursor - 1) + "\n" + value.slice(cursor), cursor);
          return;
        }
        onSubmit?.(value);
        return;
      }

      // --- deletion ---
      if (key.backspace) {
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
      if (key.delete) {
        if (key.meta) {
          const end = wordEnd(value, cursor);
          if (end === cursor) return;
          commit(value.slice(0, cursor) + value.slice(end), cursor);
          return;
        }
        if (cursor >= value.length) return;
        const fwd = nextCharLen(value, cursor);
        commit(value.slice(0, cursor) + value.slice(cursor + fwd), cursor);
        return;
      }

      if (key.ctrl && input === "w") {
        const start = wordStart(value, cursor);
        if (start === cursor) return;
        commit(value.slice(0, start) + value.slice(cursor), start);
        return;
      }
      if (key.ctrl && input === "u") {
        // Cmd+Backspace: delete from current line start to cursor.
        // If already at line start, eat the preceding newline so the empty
        // line collapses into the line above.
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

      // --- cursor movement ---
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
        const lineStart = value.slice(0, cursor).lastIndexOf("\n") + 1;
        setCursor(lineStart);
        return;
      }
      if (key.ctrl && input === "e") {
        const nextNl = value.indexOf("\n", cursor);
        setCursor(nextNl === -1 ? value.length : nextNl);
        return;
      }

      if (key.upArrow) {
        // Cmd/Option + Up → top of buffer
        if (key.meta) {
          if (cursor === 0) onHistoryPrev?.();
          else setCursor(0);
          return;
        }
        const before = value.slice(0, cursor);
        const curLineStart = before.lastIndexOf("\n") + 1;
        if (curLineStart === 0) {
          onHistoryPrev?.();
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

      // Tab → insert two spaces
      if (key.tab) {
        insertText("  ");
        return;
      }
      if (key.escape) return;
      if (key.ctrl || key.meta) return;

      // --- insertion ---
      if (input && input.length > 0) {
        insertText(input);
      }
    },
    { isActive: focus },
  );

  // Render with an inverted cursor.
  if (!value) {
    return (
      <Box>
        <Text inverse> </Text>
        {placeholder ? <Text color="gray">{placeholder}</Text> : null}
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
