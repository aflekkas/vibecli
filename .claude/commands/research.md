---
description: Pull authoritative answers from upstream library docs and source (Ink, Vercel AI SDK, MCP, etc.) before vibecli commits to an API.
argument-hint: <question>
---

Delegate to the `researcher` agent.

Question: **$ARGUMENTS**

Prefer context7 (`resolve-library-id` then `query-docs`), then read installed source in `node_modules/<lib>/`, then upstream docs/issues via WebFetch. Cite sources for every non-trivial claim. Return a short brief: question, answer, source(s), caveats, implications for vibecli.

Read-only.
