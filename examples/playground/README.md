# vibecli examples playground

In-tree canonical consumer for vibecli. Resolves `@aflekkas/vibecli/*` to local `../../src/*` via bun tsconfig paths, so edits to `src/` show up here on next run with no install or symlink dance. This is where features get vibecoded first; the generic core is then promoted into `src/` via `/promote`.

## Run interactively

```bash
# from vibecli repo root (one-time)
bun install --cwd examples/playground

# from anywhere in the vibecli repo
bun run play
```

`bun run play` is wired in the root `package.json`.

## Run a scripted scenario

```bash
bun --cwd examples/playground src/index.tsx --script scenarios/chat-basic.json
```

Scenarios are JSON arrays of `{ input, expectContains }` steps. The runner drives the agent loop, asserts assistant text contains the expected substring, exits non-zero on any failure. Used both for fast local checks and (the same files) by `scripts/smoke.ts` post-publish.

Set `ANTHROPIC_API_KEY` in `.env` (or env) before running scenarios — they hit the real provider.

## Slash commands (interactive only)

- `/theme` — switch theme live (uses `@aflekkas/vibecli/theme-picker`)
- `/clip` — stage clipboard image for next message (uses `@aflekkas/vibecli/clipboard`)
- `/clear` — reset the conversation
- `/help` — list commands
- empty submit — exit

## Distinct from `templates/playground/`

| | `examples/playground/` | `templates/playground/` |
|---|---|---|
| Role | Internal canonical consumer + vibecode harness | User-facing scaffold |
| `@aflekkas/vibecli` resolves to | local source via tsconfig paths | npm version pin |
| Shipped to npm? | no | yes (under `files: ["templates"]`) |
| Boundary applies? | no — this is the consumer; demo wiring lives here | yes — mirrors what users see |

The boundary that applies to `src/` does **not** apply here. This is the consumer side: opinionated wiring, slash commands, demo flows. Promote the generic core into `src/`, leave the demo wiring here.
