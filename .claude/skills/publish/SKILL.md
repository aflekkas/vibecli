---
name: publish
description: Single-step ship protocol for `@aflekkas/vibecli` on a clean tree — typecheck, version bump, npm publish, push tags, post-publish smoke. Triggers on `/publish`, "publish vibecli", "ship a clean release", "cut a release". For a dirty-tree end-to-end pipeline, use `/ship` instead (which orchestrates docs + commit + publish). Patch bump is the default during 0.0.x.
---

# Publish protocol

Every published version is verified post-publish by a fresh tmpdir scaffold against npm (`scripts/smoke.ts`). That guarantees a real consumer can `bun install` and run, no local-link shortcuts hiding packaging or exports issues.

## Pre-flight gates

Run these before invoking ship. If any fails, stop.

1. **Tree clean.** `git status` shows no unstaged changes. `npm version` refuses on a dirty tree by design — that's the safety net.
2. **Typecheck passes.** `bun run typecheck`.
3. **Playground works locally.** `bun run play` opens cleanly; `bun run play:script <scenario>` passes for any scripted scenario relevant to the change.
4. **README in sync.** If `package.json` `exports` changed, the README "What's in here" table matches and at least one usage example covers the new subpath. (Hand to `documentation` agent if not.)
5. **Boundary clear.** No hardcoded provider names outside the adapter, no consumer paths, no consumer tool names. (Hand to `boundary-reviewer` if unsure.)
6. **CLAUDE.md not staged accidentally.** It's tracked, but a stale CLAUDE.md edit shouldn't ride a release commit unless intentional.

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
5. `bun run smoke` — `scripts/smoke.ts`: `mkdtemp` a sandbox, scaffold the `playground` template against the just-published version, `bun install`, run every `templates/playground/scenarios/*.json` against the scaffolded app via `--script`, assert pass, cleanup.

## After ship

- The script auto-runs `scripts/smoke.ts` at the end. If smoke fails, the new vibecli version broke a public-surface contract that the scenarios exercise. Two paths:
  - **Revert.** Ship a patch `0.0.x+1` that restores the broken API, then add the new behavior in a backwards-compatible way.
  - **Fix forward in scenarios.** If the scenario was wrong (e.g. relied on outdated wording), update it and re-run smoke locally.
- For UI-only changes that scripted scenarios can't catch, also do an interactive `bun run play` against local source. The smoke covers the agent loop and exports surface; visual polish needs eyes.

## Gotchas

- **npm propagation lag.** New publishes take 30s–2min to be globally readable. The smoke step's `bunx @aflekkas/vibecli@<just-published>` may 404 immediately after publish. Wait + retry once.
- **Bun cache.** Bun caches scoped registry responses aggressively. If the smoke `bun install` returns 404 for the just-published version: `rm -rf ~/.bun/install/cache && bun install --force` and retry the smoke.
- **NPM token in `~/.npmrc`.** Granular access token. If publish fails with EOTP/403, the token expired or was revoked. Never paste it into code, env, or memory files.
- **`ANTHROPIC_API_KEY` in env.** Smoke scenarios hit the real provider. Without the key, smoke skips and exits 0 — which means a passing ship script does NOT prove scenarios ran. Set the key locally before shipping if you want full coverage.

## Hard rules

- **Commit before ship.** `npm version` requires a clean tree. If forgotten, the script refuses; stage and commit, then re-run.
- **Never `--no-verify`.** Hooks exist for a reason.
- **Never bump version manually then publish.** The script is the path.
- **Boundary holds at publish time.** Last chance to catch a leak. `boundary-reviewer` on the diff if unsure.
