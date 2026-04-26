export const DEFAULT_RESERVED: ReadonlySet<string> = new Set([
  "help",
  "clear",
  "new",
  "exit",
  "quit",
  "restart",
  "paste",
]);

export function extendReserved(...sets: Iterable<string>[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const s of sets) for (const x of s) out.add(x.toLowerCase());
  return out;
}
