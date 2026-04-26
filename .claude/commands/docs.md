---
description: Sync README, JSDoc, and package.json `exports` with the current state of `src/`.
argument-hint: [area-or-export]
---

Delegate to the `documentation` agent.

Focus: **$ARGUMENTS** (or "the latest diff" if empty).

Cross-check `package.json` `exports` ↔ README "What's in here" table ↔ usage examples. If a subpath was added, removed, or renamed, update all three in one commit. If a public function signature changed, update its usage example.

Use the canonical scoped name (`@aflekkas/vibecli/<subpath>`) in every code example.
