---
description: Promote a feature from rawdog into vibecli using the three-step cross-repo protocol.
argument-hint: <feature> [path-to-inline-impl-in-rawdog]
---

Run the `extract-from-rawdog` skill for: **$ARGUMENTS**.

Lift the generic core into `src/<module>.ts`, strip rawdog-specific bits to params or constructor args, add the subpath to `package.json` `exports`, typecheck, commit, then run the `publish` skill. Then in rawdog: rip the inline impl, swap to `import { X } from "@aflekkas/vibecli/<subpath>"`, typecheck, smoke run, commit.

Three commits across two repos, never combined. Boundary-reviewer agent must verdict **clear** before the publish step.

If the feature isn't ready to extract (still mid-iteration, only one call site, or the "generic" version would just be the rawdog version with names changed), say so and stop.
