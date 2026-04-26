type Segmenter = {
  segment(input: string): Iterable<{ segment: string }>;
};

function makeSegmenter(): Segmenter | null {
  if (typeof Intl === "undefined") return null;
  const IntlWithSegmenter = Intl as typeof Intl & {
    Segmenter?: new (locale?: string, opts?: { granularity: "grapheme" }) => Segmenter;
  };
  return typeof IntlWithSegmenter.Segmenter === "function"
    ? new IntlWithSegmenter.Segmenter(undefined, { granularity: "grapheme" })
    : null;
}

const segmenter = makeSegmenter();

// Find the start of the previous word from index i (exclusive).
// Word = run of non-whitespace, preceded by whitespace.
export function wordStart(s: string, i: number): number {
  let j = i;
  while (j > 0 && /\s/.test(s[j - 1]!)) j--;
  while (j > 0 && !/\s/.test(s[j - 1]!)) j--;
  return j;
}

export function wordEnd(s: string, i: number): number {
  let j = i;
  while (j < s.length && /\s/.test(s[j]!)) j++;
  while (j < s.length && !/\s/.test(s[j]!)) j++;
  return j;
}

// Length of the grapheme cluster ending at index i. Falls back to UTF-16 surrogate pairs.
export function prevCharLen(s: string, i: number): number {
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
export function nextCharLen(s: string, i: number): number {
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
