---
description: Promote a feature from `examples/playground/` into `src/` so it ships as part of `@aflekkas/vibecli`. Three commits, all in this repo: lift → wire → ship.
argument-hint: <feature> [path-to-inline-impl-in-the-playground]
---

Run the `promote` skill for: **$ARGUMENTS**.

Lift the generic core into `src/<module>.ts`, strip playground-specific bits to params or constructor args, add the subpath to `package.json` `exports`, typecheck, commit. Then in `examples/playground/src/index.tsx` (and the matching `templates/playground/src/index.tsx`): rip the inline impl, swap to `import { X } from "@aflekkas/vibecli/<subpath>"`, typecheck, run `bun run play:script <relevant scenario>`, commit. Then run the `publish` skill.

Three commits, never combined. Boundary-reviewer agent must verdict **clear** before the publish step.

If the feature isn't ready to promote (still mid-iteration, only one call site, or the "generic" version would just be the playground version with names changed), say so and stop.
