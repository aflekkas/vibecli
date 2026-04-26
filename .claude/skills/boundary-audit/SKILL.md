---
name: boundary-audit
description: Checklist for evaluating whether code in `src/` stays generic and consumer-agnostic. Triggers on phrases like "audit the boundary", "is this generic enough", "boundary check", or whenever you're about to commit a change to `src/`.
---

# Boundary audit

`@aflekkas/vibecli` ships only generic primitives. Anything specific to a single consumer belongs in that consumer. The boundary is a contract with future consumers — breaking it silently rots the package.

Use this checklist before committing a change to `src/`. The `boundary-reviewer` agent runs the same checklist on diffs.

## What does NOT belong in `src/`

- **Hardcoded provider names** outside `src/providers/adapter/`. The adapter inspects `"anthropic"` / `"openai"` to wire provider-specific options — that's the one designed exception. Other modules referencing provider names by string is a leak.
- **Runtime artifact paths.** `.rawdog/`, `.foocli/`, `.<consumer>/` baked in.
- **Specific tool names.** `"bash"`, `"read"`, `"spawn_agent"`, `"memory"`, `"slash_command"` etc. as identifiers, function names, or string constants.
- **Slash commands.** Any `/foo` shape inside `src/`.
- **Consumer imports.** `../rawdog/`, `@user/some-app`, anything pulling consumer config files.
- **Hidden assumptions.** Hardcoded file paths, env vars with consumer-specific names, default config values keyed to one consumer's setup.
- **Half-finished features for a single use case.** If only one consumer needs it, it should live there.

## What DOES belong

- Generic vocabulary: `tool`, `model`, `message`, `provider`, `event`, `theme`, `config`.
- Accept-via-params shape: anything that needs consumer context comes in through a constructor arg, function param, or React prop.
- Provider-specific logic confined to `src/providers/adapter/` — there because the contract is "wrap a Vercel AI SDK model into our `Provider` shape."

## How to apply

For each new or modified file in `src/`:

1. **Strip names.** Mentally rename every identifier and string constant to something generic. Does the code still make sense?
2. **Walk the imports.** Every import should be: another `src/` module, a peer dep (`react`, `ink`, `ai`), a Node built-in, or a small focused npm dep. No paths from outside the package.
3. **Walk the strings.** Search for any consumer name, tool name, slash command, runtime artifact path. Any hit is a leak.
4. **Check the parameters.** If the function takes consumer-specific input, is it accepted via param (good) or read from a hardcoded location (leak)?
5. **Hypothetical second consumer.** Could a different Ink + AI-SDK CLI use this without modification? If no, the abstraction isn't real yet.

## Verdict shape

Output one of three:

- **Clear.** No leaks, ready to ship.
- **Leaks.** List them: `file:line — fragment — fix shape (parameterize / lift to arg / drop)`.
- **Structural.** Cannot be made generic without redesign. Surface to the calling agent; this is a `refactoring` or "build it in the consumer first" decision.

## When it's NOT a leak

- Provider-name strings inside `src/providers/adapter/`.
- README/docs examples showing consumer wiring — those aren't `src/`.
- The `vibecli init` scaffolder writing template files — it's a scaffolder, generating consumer code is its job.

## Promotion is cheap, demotion is an API break

When in doubt, the feature does not belong here yet. Build it in the consumer first. Promote later via the `extract-from-rawdog` skill. Pulling something out of `package.json` `exports` after publish breaks consumers; pushing it in earlier just costs a release.
