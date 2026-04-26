---
name: publish
description: Single-step ship protocol for `@aflekkas/vibecli` on a clean tree — typecheck, version bump, npm publish, push tags, smoke-run rawdog. Triggers on `/publish`, "publish vibecli", "ship a clean release", "cut a release". For dirty-tree end-to-end, use `/ship` instead (which orchestrates docs + commit + publish). Patch bump is the default during 0.0.x.
---

# Publish protocol

Every change to vibecli ships through npm. No `bun link`, no symlinks. Rawdog only ever sees vibecli via the published artifact, so npm doubles as the integration test.

## Pre-flight gates

Run these before invoking ship. If any fails, stop.

1. **Tree clean.** `git status` shows no unstaged changes. `npm version` refuses on a dirty tree by design — that's the safety net.
2. **Typecheck passes.** `bun run typecheck`.
3. **README in sync.** If `package.json` `exports` changed, the README "What's in here" table matches and at least one usage example covers the new subpath. (Hand to `documentation` agent if not.)
4. **Boundary clear.** No hardcoded provider names outside the adapter, no consumer paths, no consumer tool names. (Hand to `boundary-reviewer` if unsure.)
5. **CLAUDE.md not staged accidentally.** It's tracked now, but a stale CLAUDE.md edit shouldn't ride a release commit unless intentional.

## Choose the bump

| Variant | When |
|---|---|
| `bun run ship` | Patch bump (`0.0.x → 0.0.x+1`). Default during pre-alpha. Most edits. |
| `bun run ship:minor` | Minor bump. First stable, or a clearly visible API addition. |
| `bun run ship:major` | Major bump. Reserve for graduation out of pre-alpha. |

While `0.0.x`, **patch every time.** Don't agonize over semver. Cut a real version when the API stops thrashing.

## What ship does

Defined in `package.json`:

1. `bun run typecheck` — fail fast.
2. `npm version patch|minor|major` — bumps `package.json`, makes a git tag, makes a commit on top of yours.
3. `npm publish --access public` — pushes to npm. Requires `~/.npmrc` token with publish scope.
4. `git push --follow-tags` — pushes commit + tag to GitHub.
5. `cd ../rawdog && bun add @aflekkas/vibecli@latest && bun run typecheck` — bumps rawdog's pin, reinstalls, type-checks against the live published artifact.

## After ship

- The script auto-typechecks rawdog at the end. If that fails, the new vibecli version broke an API rawdog uses. Two paths:
  - **Revert.** Ship a patch `0.0.x+1` that restores the API, then add the new behavior in a backwards-compatible way.
  - **Fix forward in rawdog.** Update rawdog imports/usage, commit there.
- Smoke run rawdog end-to-end if the change touched anything user-facing: `cd ~/Documents/Projects/rawdog && echo "say hi" | bun run src/index.tsx -p`.

## Gotchas

- **npm propagation lag.** New publishes take 30s–2min to be globally readable. `bun update` may 404 immediately after publish. Wait + retry once.
- **Bun cache.** Bun caches scoped registry responses aggressively. If `bun install` returns 404 for a known-published version: `rm -rf node_modules ~/.bun/install/cache && bun install --force`.
- **NPM token in `~/.npmrc`.** Granular access token. If publish fails with EOTP/403, the token expired or was revoked. Never paste it into code, env, or memory files.

## Hard rules

- **Commit before ship.** `npm version` requires a clean tree. If forgotten, the script refuses; stage and commit, then re-run.
- **Never `--no-verify`.** Hooks exist for a reason.
- **Never bump version manually then publish.** The script is the path.
- **Boundary holds at publish time.** Last chance to catch a leak. `boundary-reviewer` on the diff if unsure.
