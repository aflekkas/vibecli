export type SlashHandler = () => void | Promise<void>;

export type SlashEntry = {
  name: string;
  description?: string;
  run: SlashHandler;
};

export type SlashRegistry = {
  add: (name: string, run: SlashHandler, description?: string) => SlashRegistry;
  dispatch: (input: string) => Promise<"handled" | "unknown" | "not-slash">;
  has: (name: string) => boolean;
  entries: () => SlashEntry[];
  help: () => string;
};

function normalize(name: string): string {
  return name.replace(/^\/+/, "").trim().toLowerCase();
}

/**
 * Builds a small slash-command dispatcher. Names are stored without the
 * leading `/` and matched case-insensitively. `dispatch` returns:
 * - `"not-slash"` if the input doesn't start with `/` (caller should treat it as a regular message)
 * - `"unknown"` if no handler matches
 * - `"handled"` after the handler resolves (sync or async)
 *
 * `help()` formats `/name  description` lines suitable for a `pushMeta` call.
 */
export function createSlashRegistry(): SlashRegistry {
  const order: string[] = [];
  const map = new Map<string, SlashEntry>();
  let labelWidth = 0;

  const registry: SlashRegistry = {
    add(name, run, description) {
      const key = normalize(name);
      if (!key) return registry;
      if (!map.has(key)) order.push(key);
      map.set(key, { name: key, description, run });
      labelWidth = Math.max(labelWidth, key.length + 1);
      return registry;
    },
    has(name) {
      return map.has(normalize(name));
    },
    async dispatch(input) {
      if (!input.startsWith("/")) return "not-slash";
      const key = normalize(input.split(/\s+/)[0] ?? "");
      const entry = map.get(key);
      if (!entry) return "unknown";
      await entry.run();
      return "handled";
    },
    entries() {
      return order.map((k) => map.get(k)!);
    },
    help() {
      const width = Math.max(6, labelWidth);
      return order
        .map((k) => {
          const entry = map.get(k)!;
          const label = `/${entry.name}`.padEnd(width + 1);
          return entry.description ? `${label} ${entry.description}` : label.trimEnd();
        })
        .join("\n");
    },
  };

  return registry;
}
