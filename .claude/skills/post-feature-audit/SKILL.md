---
name: post-feature-audit
description: Comprehensive sweep after a big feature lands — file decomposition, boundary integrity, exports parity, README parity, type-check, dead code, playground integration. Triggers on `/audit`, "post-feature audit", "audit the system", "make sure everything is broken apart", or after merging a non-trivial change.
---

# Post-feature audit

Run this after any feature large enough that the codebase shifted shape. The goal is to make sure the new state is **broken apart** — small focused modules, no monoliths creeping back, the boundary held, public surface still consistent, the playground still exercises everything.

## Stages

### 1. Decomposition

For each file in `src/` touched by the feature:

- **Single purpose?** A module should do one thing. If a file's name needs `and`, split it.
- **Right size?** Files past ~250 lines or holding more than ~5 exported symbols are candidates for splitting. Not a hard rule, a smell.
- **Layered correctly?** Lower-level helpers below higher-level composition. Imports flow one direction.

If anything fails, hand to `refactoring`.

### 2. Boundary

Run the `boundary-audit` skill (or invoke `boundary-reviewer` agent) on the full feature diff. Verdict must be **clear** before declaring done.

### 3. Exports parity

- Every new module that should be importable by consumers has a subpath in `package.json` `exports`.
- Every removed/renamed module has its subpath removed/renamed in `exports`.
- The README "What's in here" table matches the `exports` set exactly.
- At least one usage example exists for any genuinely new primitive.

If anything fails, hand to `documentation`.

### 4. Type integrity

- `bun run typecheck` passes.
- No `any` introduced. (`grep -n ': any' src/` quick check.)
- No `@ts-ignore` / `@ts-expect-error` introduced. If one is necessary, it has a comment naming the upstream issue.

### 5. Dead code

- Files added but not imported anywhere → drop them.
- Functions exported but never used by `index.ts` re-exports or another `src/` module → drop or document why they exist.
- Comments referencing deleted code, old names, or "TODO: implement" without a tracking issue → clean up.

### 6. Documentation parity

- README body paragraph still accurate.
- `CLAUDE.md` "Layout" tree still matches reality.
- `docs/*.md` references valid.
- JSDoc on new exported APIs covers the *why*.

### 7. Playground + scenario coverage

- `examples/playground/src/index.tsx` imports any new public export the feature added (or has a clear reason it shouldn't, e.g. low-level helper not meant for the demo surface).
- `templates/playground/src/index.tsx` mirrors the playground wiring for anything user-facing.
- At least one new scenario in `examples/playground/scenarios/` exercises the new primitive end-to-end via the agent loop.
- `bun run play` opens cleanly; `bun run play:script <scenario>` passes locally (provider key set).

### 8. Smoke readiness

- `bun run smoke` passes against the *current* published version (catches anything subtle in the scenario shape itself before this version ships).

## Output

A report:

- **Verdict** — clear / needs work / structural.
- **Stage results** — pass/fail per stage, with specific file:line citations for any failure.
- **Recommended next moves** — which agent or skill to hand off to.

## Hard rules

- **Read-only by default.** This skill produces a report; the actual fixes happen via `refactoring`, `documentation`, or `bug-fixer` based on what was found.
- **No vague feedback.** Every "fail" must point at a specific file or behavior.
- **Don't expand scope.** If you find unrelated tech debt, note it but don't fold it into this audit.
