---
description: Scan rawdog for features that look promotable into vibecli but haven't been extracted yet. Read-only — outputs a ranked candidate list, then you pick one for /extract.
argument-hint: [optional area or filename hint]
---

Run the `extractables` skill.

Scope: **$ARGUMENTS** (or "the full rawdog `src/` tree" if empty).

Read-only cross-repo gap scan. Inventories rawdog modules, cross-references against `vibecli`'s `src/` + `package.json` `exports`, scores each candidate on liftability heuristics (single-purpose, no consumer-specific imports, no hardcoded provider names, no runtime artifact paths, reusable shape, realistic second consumer), and reports a ranked table with a "lift sketch" for the top candidates.

Pair with `/extract <name>` to actually promote one. This command never edits either repo.

Distinct from `/parity`, which surveys *external* peer Ink + AI-SDK CLIs. This one looks *inward* at rawdog.
