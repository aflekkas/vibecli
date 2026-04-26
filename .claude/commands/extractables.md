---
description: Scan `templates/playground/` for inline wiring that looks promotable into `src/` but hasn't been promoted yet. Read-only — outputs a ranked candidate list, then you pick one for /promote.
argument-hint: [optional area or filename hint]
---

Run the `extractables` skill.

Scope: **$ARGUMENTS** (or "the full `templates/playground/` tree" if empty).

Read-only gap scan. Inventories playground modules (or sections of `templates/playground/src/index.tsx`), cross-references against `src/` + `package.json` `exports`, scores each candidate on liftability heuristics (single-purpose, no consumer-specific imports, no hardcoded provider names, no runtime artifact paths, reusable shape, realistic second consumer), and reports a ranked table with a "lift sketch" for the top candidates.

Pair with `/promote <name>` to actually lift one. This command never edits anything.

Distinct from `/parity`, which surveys *external* peer Ink + AI-SDK CLIs. This one looks *inward* at the in-tree consumer.
