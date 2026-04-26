---
name: extractables
description: Scan `templates/playground/` for inline wiring that looks promotable into `src/` but hasn't been promoted yet. Triggers on `/extractables`, "what could we lift from the playground", "playground gap scan", "promotion candidates", "what's promotable".
---

# Extractables

Read-only gap scan. Surveys `templates/playground/src/` (and any other in-tree consumer) for inline implementations that look generic enough to lift into `src/`, and reports candidates ranked by liftability. Pairs with `/promote` (which does the actual three-step promotion).

This is the **inward** counterpart to `/parity` (which surveys *external* peer Ink + AI-SDK CLIs for ideas). Use this when the question is "what do we already have inline in the playground that vibecli should expose as a primitive?".

## When to run

- Periodically — every few feature cycles, or before a vibecli minor bump.
- After a stretch of playground-only work, to see what stabilized.
- Before designing a new vibecli primitive — maybe one already exists inline.

## Procedure

Strictly read-only. No edits, no commits. Output is a ranked list the user picks from before `/promote`.

### 1. Inventory playground modules

```bash
ls -la templates/playground/src/
wc -l templates/playground/src/*.{ts,tsx} 2>/dev/null
```

For each non-trivial module or self-contained section of `templates/playground/src/index.tsx`, capture: location, LoC, exports, what it does in one line.

Skip:
- Top-level `App` wiring — by design, the playground composes; that's not a lift candidate.
- Anything explicitly named after demo-only behavior (e.g. `slash-handler.tsx`).

### 2. Cross-reference `src/`

```bash
ls src/
cat package.json | jq '.exports'
```

Mark each playground module as one of:
- **already in `src/`** — same primitive exists. Skip.
- **partial overlap** — `src/` has a related primitive; the playground might have a richer version. Note the diff.
- **not in `src/`** — candidate. Continue scoring.

### 3. Score liftability per candidate

For each candidate, check the heuristics. Each `yes` is one point.

| Heuristic | What to check |
|---|---|
| **Single-purpose.** Module does one thing (a widget, a helper, a normalizer, a loader). | Name + exports tell you what it is in one line. |
| **No consumer-specific imports.** Doesn't pull in playground demo state, slash-command registry, or Ink scaffolding that wouldn't make sense outside the playground. | `grep -E "from \"\.\./" <file>` — clean = good. |
| **No hardcoded provider names.** No literal `"anthropic"` / `"openai"` / `"google"` outside provider adapter code. | `grep -iE "anthropic\|openai\|google\|claude" <file>` — only param names allowed. |
| **No runtime artifact paths.** No `.<consumer>/`, no consumer config dirs. | `grep -E "\.[a-z]+/" <file>` for suspicious patterns. |
| **No slash-command or tool-name strings.** No literal `/init`, `/clear`, tool names baked in. | Reading the code. |
| **Reusable shape.** Public surface looks like params in, value out — not a god-class wired to demo state. | Read the exports. |
| **Realistic second consumer.** Not so niche that only the playground would ever want it. | Judgment call; state the hypothetical second consumer. |

Verdict per candidate:
- **6–7 yes** → "lift candidate" — ready for `/promote <name>`.
- **3–5 yes** → "needs decoupling first" — list which heuristics fail and what would have to change in the playground before lift.
- **0–2 yes** → "playground-specific, skip" — don't bother.

### 4. Report

Markdown table, one row per candidate, sorted by liftability score descending. Columns:

| Score | playground location | What it is | Verdict | Notes |
|---|---|---|---|---|

Below the table, for the top 3 candidates, write a 2–3 sentence "lift sketch": what the generic core would be, what params would replace playground-specific bits, what the vibecli subpath name should be.

End with: "Run `/promote <name>` on the one you want to lift. Three-commit flow: lift → wire → ship."

## Hard rules

- **Read-only.** Never edit. The skill outputs a list, the user decides, `/promote` does the lift.
- **No suggesting bulk lifts.** Three commits per primitive is the protocol; multi-feature lifts squash and lose the bisect surface.
- **Don't confuse with `/parity`.** Peers/external = `/parity`. Playground/internal = this.
- **Anything `<50` LoC is probably too small to bother lifting.** Note it for awareness, but don't recommend a lift unless it's a primitive that other consumers would obviously reach for.
