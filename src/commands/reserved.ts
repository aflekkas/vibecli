export const DEFAULT_RESERVED: ReadonlySet<string> = new Set([
  "help",
  "clear",
  "new",
  "exit",
  "quit",
  "restart",
  "paste",
]);

/**
 * Merges `DEFAULT_RESERVED` with any number of additional name sets into a
 * single lowercase-normalized `ReadonlySet`. Pass your app's slash-command
 * names so `loadMarkdownDir` can skip conflicts.
 */
export function extendReserved(...sets: Iterable<string>[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const s of sets) for (const x of s) out.add(x.toLowerCase());
  return out;
}
