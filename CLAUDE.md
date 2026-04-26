# CLAUDE.md

This repo's authoritative rules live in `AGENTS.md`. Read it before any change.

@AGENTS.md

## Hard rules — do not skip

1. **Boundary** (AGENTS.md "Boundary"): every file here must be generic. No hardcoded provider names, runtime artifact paths (`.rawdog/`, etc.), tool names, slash commands, or imports from any consumer. If a feature needs consumer context, accept it via params. When in doubt, the feature does not belong here — add it in the consumer.
2. **Type check before declaring done**: `bun run typecheck`. No separate test suite. Verify behavior by exercising rawdog (`~/Documents/Projects/rawdog/`), the canonical consumer.
3. **Publish discipline** (AGENTS.md "Cross-repo workflow"): when a change settles, bump version + push to GitHub + `bun publish`. Then bump the pin in rawdog (`~/Documents/Projects/rawdog/package.json`) and `bun install` there. Don't let the published artifact and what consumers actually run drift apart.
4. **README is part of the public surface**: any change to exported API → update `README.md` in the same commit.

## Workflow

- Live link: rawdog at `~/Documents/Projects/rawdog/` is `bun link`'d to this checkout. Edits here show up in rawdog immediately, no publish needed during iteration.
- Public surface: `package.json` `exports` field is the source of truth for what subpaths consumers can import (`vibecli/text-input`, `vibecli/providers`, etc.). Adding a new module = also add a subpath to `exports`.
- Commit style: short imperative lowercase, one behavioral change per commit. Bump-and-publish lives in its own commit.
