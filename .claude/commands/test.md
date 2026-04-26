---
description: Add or maintain colocated tests for vibecli, plus drive smoke runs through rawdog.
argument-hint: [module-or-area]
---

Delegate to the `testing` agent.

Target: **$ARGUMENTS** (or "the latest change" if empty).

Add colocated `<module>.test.ts` next to the code it covers, using `bun:test`. Test only pure-logic cores (parsing, retry math, repo-map filtering, LSP offsets, MCP normalization, color/wrap math). Skip Ink components and thin re-export shims. Run `bun test <file>` to confirm green. After ship, smoke rawdog if the change is API-shaped.

No mocks for `ai` or `ink`. No global setup files. No flaky timing-dependent tests.
