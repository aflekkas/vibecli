---
name: extractables
description: Scan rawdog for features that look promotable into vibecli but haven't been extracted yet. Triggers on `/extractables`, "what could we lift from rawdog", "rawdog gap scan", "extract candidates", "what's promotable".
---

# Extractables

Read-only cross-repo gap scan. Surveys `~/Documents/Projects/rawdog/src/` for self-contained primitives that look generic enough to lift into `vibecli`, and reports candidates ranked by liftability. Pairs with `/extract` (which does the actual three-step promotion).

This is the **inward** counterpart to `/parity` (which surveys *external* peer Ink + AI-SDK CLIs for ideas). Use this when the question is "what do we already have in rawdog that vibecli should expose?".

## When to run

- Periodically — every few rawdog feature cycles, or before a vibecli minor bump.
- After a stretch of rawdog-only work, to see what stabilized.
- Before designing a new vibecli primitive — maybe one already exists inline.

## Procedure

Strictly read-only. No edits, no commits. Output is a ranked list the user picks from before `/extract`.

### 1. Inventory rawdog modules

```bash
ls -la ~/Documents/Projects/rawdog/src/
wc -l ~/Documents/Projects/rawdog/src/*.{ts,tsx} 2>/dev/null
```

For each non-trivial module, capture: path, LoC, top-level exports, what it does in one line.

Skip:
- `index.tsx` and other top-level wiring — by design, these are app-specific.
- Anything explicitly named after rawdog domain (e.g. `rawdog-config.ts`).

### 2. Cross-reference vibecli

```bash
ls ~/Documents/Projects/vibecli/src/
cat ~/Documents/Projects/vibecli/package.json | jq '.exports'
```

Mark each rawdog module as one of:
- **already in vibecli** — same primitive exists. Skip.
- **partial overlap** — vibecli has a related primitive; rawdog might have a richer version. Note the diff.
- **not in vibecli** — candidate. Continue scoring.

### 3. Score liftability per candidate

For each candidate, check the heuristics. Each `yes` is one point.

| Heuristic | What to check |
|---|---|
| **Single-purpose.** Module does one thing (a widget, a helper, a normalizer, a loader). | Name + exports tell you what it is in one line. |
| **No consumer-specific imports.** Doesn't pull in rawdog config, rawdog tool registry, rawdog session model. | `grep -E "from \"\.\./(config\|tools\|sessions\|hooks)" <file>` — clean = good. |
| **No hardcoded provider names.** No literal "anthropic"/"openai"/"google" outside provider adapter code. | `grep -iE "anthropic\|openai\|google\|claude" <file>` — only param names allowed. |
| **No runtime artifact paths.** No `.rawdog/`, no `~/.rawdog/`, no consumer config dirs. | `grep -E "\.rawdog\|rawdog/" <file>`. |
| **No slash-command or tool-name strings.** No literal `/init`, `/clear`, tool names baked in. | Reading the file. |
| **Reusable shape.** Public surface looks like params in, value out — not a god-class wired to rawdog state. | Read the exports. |
| **Realistic second consumer.** Not so niche that only rawdog would ever want it. | Judgment call; state the hypothetical second consumer. |

Verdict per candidate:
- **6–7 yes** → "lift candidate" — ready for `/extract <name>`.
- **3–5 yes** → "needs decoupling first" — list which heuristics fail and what would have to change in rawdog before lift.
- **0–2 yes** → "rawdog-specific, skip" — don't bother.

### 4. Report

Markdown table, one row per candidate, sorted by liftability score descending. Columns:

| Score | rawdog path | What it is | Verdict | Notes |
|---|---|---|---|---|

Below the table, for the top 3 candidates, write a 2–3 sentence "lift sketch": what the generic core would be, what params would replace rawdog-specific bits, what the vibecli subpath name should be.

End with: "Run `/extract <name>` on the one you want to promote. Default cross-repo flow stays three commits."

## Hard rules

- **Read-only.** Never edit either repo. The skill outputs a list, the user decides, `/extract` does the lift.
- **No suggesting bulk extracts.** Three commits per feature is the protocol; multi-feature extracts get squashed and lose the bisect surface.
- **Don't confuse with `/parity`.** Peers/external = `/parity`. Rawdog/internal = this.
- **Anything `<50` LoC is probably too small to bother extracting.** Note it for awareness, but don't recommend a lift unless it's a primitive that other consumers would obviously reach for.
