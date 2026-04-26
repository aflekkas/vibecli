---
description: Repro a reported bug, find root cause, ship the minimal fix.
argument-hint: <bug-description-or-issue-link>
---

Delegate to the `bug-fixer` agent.

Bug: **$ARGUMENTS**

Repro first; if it can't be reproduced, surface that and stop. Use `git log -p -S<symbol>` and `git blame` to trace how the offending code got its shape. Multi-hypothesis if non-obvious. Minimal fix at the root cause — no opportunistic refactors, no symptom suppression, no swallowed errors. Add a regression test if the bug was in pure logic.

Hand off as needed: `researcher` for upstream-library questions, `refactoring` if the fix wants to grow structural, `documentation` if the fix changes a public export, `boundary-reviewer` if the fix shape risks the boundary.
