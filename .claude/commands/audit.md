---
description: Comprehensive post-feature sweep — decomposition, boundary, exports parity, README parity, type integrity, dead code, consumer integration.
argument-hint: [feature-name-or-commit-range]
---

Run the `post-feature-audit` skill.

Scope: **$ARGUMENTS** (or "the latest feature on this branch" if empty).

Walks all seven stages: decomposition, boundary, exports parity, type integrity, dead code, documentation parity, consumer integration. Returns a verdict (clear / needs work / structural) plus pass/fail per stage with file:line citations.

Read-only. Hand fixes to `refactoring`, `documentation`, or `bug-fixer` based on what the audit surfaces.
