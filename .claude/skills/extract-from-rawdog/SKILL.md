---
name: extract-from-rawdog
description: Three-step cross-repo procedure for promoting a feature from rawdog into vibecli — lift the generic core, ship a new vibecli version, swap rawdog to import it. Triggers on phrases like "extract X from rawdog", "promote X to vibecli", "lift X out of rawdog into vibecli", "/extract".
---

# Extract from rawdog

The default cross-repo flow for `@aflekkas/vibecli` is **vibecode in rawdog first, extract here later.** Rawdog is the playground; vibecli follows. This skill is the protocol.

When to extract: feature is stable, generic core is visible after stripping rawdog-specific names, and a second consumer is realistic. If only one or two of those hold, **do not extract yet.**

## The three moves

Three distinct commits across two repos. Never combine them.

### 1. Lift to vibecli

In `~/Documents/Projects/vibecli`:

1. Read the inline implementation in rawdog. Identify the generic core.
2. Create `src/<module>.ts` (or `.tsx`) holding only the generic core.
3. **Strip rawdog-specific bits to params or constructor args.** Paths, tool names, config keys, slash-command wiring — none of these belong here.
4. Add the subpath to `package.json` `exports`:
   ```json
   "./<module>": "./src/<module>.ts"
   ```
5. If a public function/class signature changed shape, update `README.md` "What's in here" table and add a usage example.
6. `bun run typecheck`.
7. Commit: short imperative, e.g. `add <feature> primitive`.

### 2. Ship to npm

Run the `publish` skill (or `/publish` / `/ship`). `bun run ship` does:
- `bun run typecheck`
- `npm version patch` (default during 0.0.x)
- `npm publish --access public`
- `git push --follow-tags`
- `cd ../rawdog && bun add @aflekkas/vibecli@latest && bun run typecheck`

### 3. Swap rawdog

In `~/Documents/Projects/rawdog`:

1. Confirm rawdog's `package.json` now pins the new vibecli version.
2. **Delete the inline implementation entirely.** No re-export shim, no dead copy.
3. Replace usages with `import { X } from "@aflekkas/vibecli/<module>"`.
4. `bun run typecheck`.
5. Smoke run: `echo "say hi" | bun run src/index.tsx -p`.
6. Commit in rawdog: short imperative, e.g. `swap <feature> to @aflekkas/vibecli`.

## Naming

Keep the same module name in both repos so the extract is unambiguous. e.g. rawdog inline `src/clipboard-paste.ts` → vibecli `src/clipboard.ts`.

## Red flags — do not extract yet

- Inline impl imports from rawdog config / tools / `.rawdog/` paths. **Parameterize in rawdog first.**
- Only one call site, no realistic second consumer in sight.
- Inline impl is still mid-iteration — let it settle.
- The "generic" version would just be the rawdog version with names changed — there's nothing real to lift.

## After extract

- Inline rawdog version was throwaway, don't polish it before extract. Polish lands in vibecli.
- Boundary check: invoke the `boundary-reviewer` agent on the new `src/<module>.ts` before shipping. Anything consumer-specific must come out before the first publish.
- Documentation check: invoke the `documentation` agent to keep README parity.

## Hard rules

- **Never wire rawdog against an unpublished vibecli version.** No `bun link`, no `file:` protocol, no symlinks. Ship a real npm version, then bump rawdog.
- **Never combine rawdog inline → swap into one commit.** The inline → vibecli ship → swap is a three-commit sequence by design; squashing it loses the bisect surface.
- **Patch bump is the default during 0.0.x.** Don't agonize over semver yet.
