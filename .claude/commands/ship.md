---
description: One-shot release pipeline for `@aflekkas/vibecli`. Wires new exports, syncs docs, audits the boundary, commits, then runs /publish (npm version + publish + push tags + smoke rawdog). Handles a dirty tree end-to-end. Auto-fire on "ship it", "ship everything", "ship this", "ship the release", "publish everything", "cut a release", "release it", "let's ship", or `/ship`. Default bump is patch during 0.0.x.
argument-hint: [patch|minor|major]
---

Full release orchestrator for `@aflekkas/vibecli`. Handles a dirty tree end-to-end, unlike `/publish` which gates on clean.

Bump kind: `$ARGUMENTS` (default: `patch` if empty).

## Flow

Run sequentially. Stop and surface on any failure — never bypass.

1. **Survey.** `git status`, `git diff`, `git diff --cached`. Identify:
   - new files in `src/` that may need a `package.json` `exports` subpath
   - any modified public API surface
   - anything outside `src/` that should be excluded from a release commit (stale CLAUDE.md edits, scratch files, etc.)

2. **Exports + README parity.** If any new `src/*.ts`/`src/*.tsx` module is missing from `package.json` `exports`, or any export was renamed/removed, delegate to the `documentation` agent. It must:
   - add/update the subpath in `exports`
   - update the "What's in here" table in `README.md`
   - add a usage example using the scoped name `@aflekkas/vibecli/<subpath>`
   Skip this step only if the diff is purely internal (no new public surface).

3. **Boundary check.** Delegate to `boundary-reviewer` on the unstaged + staged diff. Hard fail on hardcoded provider names outside `src/providers/adapter/`, runtime artifact paths, consumer tool names, or imports from any consumer. If it flags a leak, hand to `refactoring` before continuing — do not commit through it.

4. **Typecheck.** `bun run typecheck`. Fail fast.

5. **Commit.** Delegate to the `git` agent with hint "infer from the diff". One commit, short imperative lowercase, single behavioral change. Never combine with the auto-bump commit that `npm version` makes — that comes next.

6. **Publish.** Invoke the `publish` skill with the chosen bump. It runs `bun run ship` (or `:minor`/`:major`), which does typecheck → `npm version` → `npm publish` → `git push --follow-tags` → `cd ../rawdog && bun add @aflekkas/vibecli@latest && bun run typecheck`.

7. **Report.** New version, rawdog typecheck status, any propagation/cache issues. If rawdog typecheck fails post-bump, surface immediately — that's a real API break needing a forward fix or revert patch.

## Hard rules

- Confirm with the user before step 6. Publishing to npm + pushing a tagged commit are user-visible side effects.
- Never `--force` to main, never `--no-verify`, never edit `git config`.
- If the diff has no behavioral change (only docs/comments), still ship — `documentation` parity is itself a valid release reason at 0.0.x.
- If there's nothing uncommitted and nothing to publish, say so and stop. Do not invent work.

## When to use which

| Command | Tree state | What it does |
|---|---|---|
| `/git` | dirty | Commit only. No publish. |
| `/publish` | clean | Publish only. Refuses dirty tree. |
| `/ship` | any | Full pipeline: parity → audit → commit → publish. |
