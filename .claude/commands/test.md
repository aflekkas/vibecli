---
description: Add or maintain verification for vibecli — colocated unit tests for pure logic, plus playground scenarios for end-to-end coverage.
argument-hint: [module-or-area]
---

Delegate to the `testing` agent.

Target: **$ARGUMENTS** (or "the latest change" if empty).

For pure-logic cores (parsing, retry math, repo-map filtering, LSP offsets, MCP normalization, color/wrap math): add colocated `<module>.test.ts` next to the code, using `bun:test`, run `bun test <file>` to confirm green. Skip Ink components and thin re-export shims.

For anything reachable through the agent loop: add or update a scenario in `examples/playground/scenarios/` (`{ input, expectContains }` JSON), wire the surface into `examples/playground/src/index.tsx` if not already there, run `bun run play:script scenarios/<file>.json`. The same scenarios run automatically in `bun run smoke` post-publish, so coverage compounds.

No mocks for `ai` or `ink`. No global setup files. No flaky timing-dependent tests.
