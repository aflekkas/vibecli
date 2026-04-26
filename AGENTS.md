# Repository Guidelines

## What this is

`vibecli` is a small library of reusable primitives for AI CLIs built on Ink + the Vercel AI SDK. Extracted from [rawdog](https://github.com/aflekkas/rawdog), the dogfooding consumer. Pre-alpha — API will move.

## Project Structure

Single npm package. No monorepo, no build step (consumed as TypeScript source via Bun, bundlers, or `tsc`).

```
src/
├── index.ts                      grab-bag re-exports
├── text-input.tsx                <TextInput> Ink widget
├── clipboard.ts                  macOS clipboard text + image extraction
├── highlight.ts                  markdown code-fence syntax highlighter
├── ui.tsx                        color math, gradient text, terminal text wrap
├── retry.ts                      exponential-backoff retry wrapper
└── providers/
    ├── types.ts                  Provider, Message, ContentBlock, ToolDef
    └── adapter.ts                AiSdkProvider — Vercel AI SDK adapter
```

Subpaths exposed via `package.json` `exports`. Consumers import as `@aflekkas/vibecli/<subpath>` (e.g., `@aflekkas/vibecli/text-input`, `@aflekkas/vibecli/providers`, `@aflekkas/vibecli/providers/adapter`).

## Boundary (hard rule)

Code in this repo must be **generic**. Anything an arbitrary Ink + AI SDK CLI might want — yes. Anything specific to a single consumer — no.

What does NOT belong here:
- hardcoded provider names (`"openai"`, `"anthropic"`)
- references to specific runtime artifacts (`.rawdog/`, `.foocli/`, etc.)
- specific tool names (`bash`, `read`, `spawn_agent`, …)
- slash commands or app-specific keybindings
- imports from any consumer

If a feature needs consumer-specific context, accept it via constructor args / function params / React props. Never inline it.

When in doubt: **does not belong here.** Add it in the consumer instead. Promotion to vibecli later is cheap; demotion after publish is an API break.

## Cross-repo workflow with rawdog

Rawdog is the canonical consumer at `~/Documents/Projects/rawdog/`. During local dev, rawdog is `bun link`'d to this repo's checkout, so edits here show up in rawdog instantly.

Publishing flow when a change settles:

1. Update `src/`, type-check (`bun run typecheck`).
2. Update `README.md` if the public API changed.
3. Bump `package.json` `version` (`0.0.x` while pre-alpha).
4. `git commit` + `git push` to GitHub.
5. `bun publish` (or `npm publish`) to npm.
6. In rawdog: `bun update vibecli` (or bump pin in `package.json` then `bun install`). Verify rawdog still types + runs.

For tight iteration without publishing every change, just edit here — the link picks it up. Publish once the change is real.

## Build, Test, and Development Commands

```bash
bun install
bun run typecheck          # bunx tsc --noEmit
bun publish                # ship to npm (requires npm login)
```

No test suite yet. Verify changes by typecheck and by exercising rawdog (the canonical consumer).

## Coding Style & Naming Conventions

TypeScript ESM with strict mode enabled. 2-space indentation, double quotes, semicolons, explicit `.ts` / `.tsx` imports for relative paths (`./types.ts`). `PascalCase` for React components and exported classes, `camelCase` for functions and variables. Keep modules small and single-purpose. Concise comments only where the WHY is non-obvious.

## Commit & Pull Request Guidelines

Short, imperative summaries in lowercase, e.g. `add paste handling to text input`, `fix gradient phase wraparound`. One behavioral change per commit. Bump version + publish in a separate commit so the publish boundary is clear in git history.

## License

MIT. See `LICENSE` (TODO: add file).
