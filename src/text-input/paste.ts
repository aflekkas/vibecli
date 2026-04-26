export const PASTE_START = "[200~";
export const PASTE_END_WITH_ESC = "\x1b[201~";
export const PASTE_END_BARE = "[201~";

export type PasteEnd = {
  index: number;
  length: number;
};

export function findPasteEnd(input: string): PasteEnd | null {
  const endEsc = input.indexOf(PASTE_END_WITH_ESC);
  const endBare = input.indexOf(PASTE_END_BARE);
  if (endEsc >= 0) return { index: endEsc, length: PASTE_END_WITH_ESC.length };
  if (endBare >= 0) return { index: endBare, length: PASTE_END_BARE.length };
  return null;
}
