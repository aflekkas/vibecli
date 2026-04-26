import { fileURLToPath, pathToFileURL } from "node:url";

export type LspPosition = {
  line: number;
  character: number;
};

export type LspRange = {
  start: LspPosition;
  end: LspPosition;
};

export type LspLocation = {
  uri: string;
  range: LspRange;
};

export function pathToUri(path: string): string {
  return pathToFileURL(path).href;
}

export function uriToPath(uri: string): string {
  return fileURLToPath(uri);
}

export function createLineIndex(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

export function positionAt(text: string, offset: number, lineIndex = createLineIndex(text)): LspPosition {
  const bounded = Math.max(0, Math.min(offset, text.length));
  let low = 0;
  let high = lineIndex.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lineStart = lineIndex[mid]!;
    const nextLineStart = lineIndex[mid + 1] ?? Number.POSITIVE_INFINITY;
    if (bounded < lineStart) high = mid - 1;
    else if (bounded >= nextLineStart) low = mid + 1;
    else return { line: mid, character: bounded - lineStart };
  }

  const lastLine = lineIndex.length - 1;
  return { line: lastLine, character: bounded - lineIndex[lastLine]! };
}

export function offsetAt(text: string, position: LspPosition, lineIndex = createLineIndex(text)): number {
  const line = Math.max(0, Math.min(position.line, lineIndex.length - 1));
  const lineStart = lineIndex[line]!;
  const nextLineStart = lineIndex[line + 1] ?? text.length + 1;
  const lineEnd = Math.max(lineStart, nextLineStart - 1);
  return Math.max(lineStart, Math.min(lineStart + position.character, lineEnd));
}

export function rangeAt(text: string, startOffset: number, endOffset: number): LspRange {
  const lineIndex = createLineIndex(text);
  return {
    start: positionAt(text, startOffset, lineIndex),
    end: positionAt(text, endOffset, lineIndex),
  };
}

export function textInRange(text: string, range: LspRange): string {
  const lineIndex = createLineIndex(text);
  return text.slice(offsetAt(text, range.start, lineIndex), offsetAt(text, range.end, lineIndex));
}
