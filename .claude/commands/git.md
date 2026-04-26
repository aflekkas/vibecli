---
description: Stage, commit, and (optionally) push routine changes — not for releases. Releases go through /publish.
argument-hint: [optional commit-message-hint]
---

Delegate to the `git` agent.

Hint: **$ARGUMENTS** (or "infer from the diff" if empty).

Inspect (`git status`, `git diff`, `git diff --cached`, recent log), triage staging (no `git add -A` blind, skip secrets), write a short imperative lowercase commit message matching house style, commit (no `--amend`, no `--no-verify`), and push if the user asked for it. Confirm before pushing if not already authorized.

Hard limits: never `--force` to main, never edit `git config`, never combine routine work with the auto-bump release commit, never bypass hooks.
