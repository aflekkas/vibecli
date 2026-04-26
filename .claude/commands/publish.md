---
description: Ship a release of @aflekkas/vibecli (typecheck → commit → npm publish → push tags → smoke rawdog). Defaults to a patch bump.
argument-hint: [patch|minor|major]
---

Run the `publish` skill end-to-end for `@aflekkas/vibecli`.

Bump kind: `$ARGUMENTS` (default: `patch` if empty).

Pre-flight: tree clean, `bun run typecheck` green, README parity with `package.json` `exports`, boundary clear. If any gate fails, surface and stop — do not bypass.

Then run the matching script:

- `patch` (default) → `bun run ship`
- `minor` → `bun run ship:minor`
- `major` → `bun run ship:major`

Confirm before invoking: this publishes to npm and pushes a tagged commit to GitHub. Both are user-visible side effects.

After ship: report new version, rawdog typecheck status, and any propagation issues. If rawdog typecheck fails post-bump, surface immediately — that's a real API break that needs a forward fix or revert.
