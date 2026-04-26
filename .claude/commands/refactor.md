---
description: Reshape `src/` for clarity, decomposition, or boundary integrity without changing the public API.
argument-hint: <area-or-file>
---

Delegate to the `refactoring` agent.

Target: **$ARGUMENTS**

Hold two things constant: the public API (`package.json` `exports` + every exported function signature) and the boundary (no consumer-specific names, paths, tools, or imports). Diagnose first, plan the cut in 5 lines or less, execute as small commits (one move per commit), typecheck after every move. Hand to `boundary-reviewer` before declaring done. Hand to `documentation` if module names or layout shifted.

If the right answer needs a public-API change, stop and surface it as a breaking-change conversation, not a refactor.
