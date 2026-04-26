---
name: promote
description: Three-step procedure for promoting a feature from `examples/playground/` into `src/` so it ships as part of `@aflekkas/vibecli`. Triggers on phrases like "promote X", "lift X into src", "make X part of the public API", "/promote".
---

# Promote

vibecli is an extracted library. The default flow is **vibecode in `examples/playground/` first, promote into `src/` later.** This skill is the protocol for that promotion.

When to promote: the feature is stable in the playground, the generic core is visible after stripping demo-only wiring, and a hypothetical second consumer (someone scaffolding a CLI from the published package) would obviously want it. If only one of those holds, **don't promote yet.**

## The three moves

Three distinct commits, all in this repo. Never combine them.

### 1. Lift the generic core to `src/`

1. Read the inline implementation in `examples/playground/src/index.tsx` (or wherever it lives in the playground tree).
2. Create `src/<module>.ts` (or `.tsx`) holding only the generic core.
3. **Strip playground-specific bits to params or constructor args.** No tool names, no slash command literals, no demo wiring, no consumer-specific config keys.
4. Add the subpath to `package.json` `exports`:
   ```json
   "./<module>": "./src/<module>.ts"
   ```
5. If the public function/class signature changed shape, update `README.md` "What's in here" table and add at least one usage example.
6. Add a matching scenario to `examples/playground/scenarios/` if the new primitive is exercised through the agent loop.
7. `bun run typecheck`.
8. Commit: short imperative, e.g. `add <feature> primitive`.

### 2. Wire the playground against the new public surface

Same repo, separate commit so the lift is bisectable.

1. In `examples/playground/src/index.tsx`, replace the inline implementation with `import { X } from "@aflekkas/vibecli/<module>"`. Tsconfig paths resolve this to local `src/`, so no install is needed.
2. Update `templates/playground/src/index.tsx` to expose the same wiring (this is what real users get when they scaffold).
3. `bun run typecheck`.
4. `bun run play` — verify it runs interactively against local source.
5. `bun run play:script scenarios/<relevant>.json` — verify scripted scenario passes.
6. Commit: short imperative, e.g. `wire <feature> into playground + template`.

### 3. Ship

Run the `publish` skill (or `/publish` / `/ship`). `bun run ship` does typecheck → version bump → npm publish → push tags → `bun run smoke` (post-publish tmpdir scaffold + scenario runs against the just-published version).

## Naming

Subpath name = the conceptual primitive, not the demo wiring. Example: `clipboard` (primitive) not `clipboard-paste-handler` (demo wiring).

## Red flags — do not promote yet

- Inline impl reads from playground-specific config or imports demo-only modules. **Parameterize in the playground first.**
- Only one call site, no realistic second consumer in sight.
- Inline impl is still mid-iteration — let it settle.
- The "generic" version would just be the playground version with names changed — there's nothing real to lift.

## After promote

- The boundary-reviewer agent runs against the new `src/<module>.ts` before shipping. Anything consumer-specific must come out before the first publish.
- The documentation agent keeps README parity.

## Hard rules

- **Never combine the three commits.** Lift → wire → ship is a three-commit sequence by design; squashing it loses the bisect surface.
- **Never reach into the playground from `src/`.** The playground depends on `src/`, not the other way around.
- **Patch bump is the default during 0.0.x.** Don't agonize over semver yet.
