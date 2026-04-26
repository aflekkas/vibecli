# Thesis

vibecli exists because building an agentic CLI tool should not require a framework. An AI agent is a loop. A harness is a context-injector and a command-runner. The "magic" of Claude Code, Cursor, Cline, Aider, and every closed agent product is mostly disciplined IO around the same skeleton. vibecli ships that skeleton as small, single-purpose primitives, plus a scaffolder that drops you into a runnable Ink + AI-SDK CLI in one command. From there, your harness is your filesystem layout. Your agent's identity is a string. Your slash commands are markdown files. Your tools are functions you write. Anyone with an afternoon and an API key can stand up their own CLI agent for their own use case.

The rest of this document is a defense of those four sentences.

## Agents are loops

Every agent you have ever interacted with, regardless of vendor branding, runs roughly this loop:

```
while not done:
  prompt   = build_prompt(system, history, tools)
  response = stream(model, prompt)
  for chunk in response:
    if chunk is text:        emit to user
    if chunk is thinking:    optionally emit
    if chunk is tool_call:   queue
  for call in tool_calls:
    result = run_tool(call)
    history.append(tool_result(result))
  if no tool calls in this turn:
    done = true
history.append(assistant_turn)
```

That is the entire abstraction. Every variant — interrupts, parallel tool execution, context compaction, plan mode, sub-agents, hooks — is a small, well-named hook on this skeleton. Streaming is a detail of `response`. Multi-modal is a detail of `prompt`. Memory is a detail of `history`. None of it requires a framework.

vibecli's `src/agent.ts` is the existence proof. `createAgent(provider, system, opts)` returns an object with `send(input) → AsyncIterable<AgentEvent>`. The events are the only public contract: `text`, `thinking`, `tool_start`, `tool_end`, `done`, plus a few lifecycle ones for compaction and abort. There is no inversion of control. The function does not own your render. It does not own your input. It does not own your config. You feed it a string, you read events, you decide what to do with them.

When a framework hides this loop from you, you lose the ability to:

- Insert your own tool-permission check before execution.
- Snapshot state between turns for undo.
- Inject extra context into a single turn without polluting history.
- Replace one tool's execution with a mock for tests.
- Stream the response into a custom UI that is not a chat bubble.

These are not exotic asks. They are the table stakes of building an agent product that does anything specific. The cost of "the framework owns the loop" is that you fight the framework on every one of these. The cost of "you own the loop" is that you write maybe forty lines of glue. vibecli picks the second tradeoff and ships the parts of the forty lines that benefit from sharing — the provider adapter, the streaming event types, the tool-call wiring, the abort plumbing.

## A harness is a context injector + a command runner

Strip the marketing off any agent product and you find the same five jobs:

1. **Read context in.** Files, screenshots, clipboard, repo map, terminal output, environment.
2. **Render a prompt.** System prompt, tool specs, history, the current user turn.
3. **Stream the model's response.** Text, thinking, tool calls, done.
4. **Run tool calls.** With the right side-effects: filesystem writes, shell commands, network requests, MCP calls.
5. **Display output.** Color, gradient, syntax highlight, scroll buffer, modal pickers, slash commands.

That is a harness. Steps 1, 2, 5 are the "context injector." Step 4 is the "command runner." Step 3 is the loop from the section above. None of these jobs are conceptually hard. They are tedious to do well, and they look identical across every agent product.

vibecli ships primitives for each:

- **Read context in.** `repo-map` walks a project and emits a compact file tree with language and kind summaries. `clipboard` extracts text and image data from the macOS pasteboard. `frontmatter` and `markdown-dir` load directories of `.md` files into typed entries. `lsp` converts byte offsets into LSP positions and ranges for code-aware tools.
- **Render a prompt.** The provider adapter handles system-prompt placement, tool spec serialization, message history, and provider-specific options like Anthropic prompt caching and OpenAI prompt-cache keys. You bring the strings. It handles the wire format.
- **Stream the model's response.** `providers/adapter` wraps Vercel AI SDK models. `agent` consumes the stream and lifts it into a domain-shaped event union. `chat` exposes a React hook on top of the event union.
- **Run tool calls.** `mcp` normalizes MCP tools and tool results into the same `ToolDef` and `ContentBlock` types the agent loop already speaks. `permissions` evaluates glob-based allow/ask/deny rules across five permission modes. `settings` loads a hierarchy of JSON config files with per-key array merge policies.
- **Display output.** `text-input` is a real Ink text input that handles paste, undo, cursor navigation, multi-line buffers, and configurable submit/newline bindings. `picker` and `theme-picker` are modal selectors. `themes` ships six built-ins and `defineTheme` for custom ones. `highlight` syntax-highlights streaming markdown. `ui` does color math, gradients, and terminal-safe text wrapping.

Each one is a small file in `src/`. Each one is documented under one subpath import. None of them assume anything about your product. You compose them. You do not extend them.

This is also why the package is called vibe**cli**, not vibe**framework**. The bet is that primitives compose, and frameworks calcify.

## The motivating use case

Imagine you work at a company. The company has internal tools, internal data, an OAuth flow that your IT team owns, and a domain language that nobody outside the building understands. Engineers love using AI coding agents on their personal projects but they cannot use the closed products on company work because:

- The closed products send code and context to vendors, and your security team has not signed off on the specific data flows.
- The closed products have no way to plug in your OAuth provider for internal API access.
- The closed products do not know your domain language, your internal RPC clients, your CI conventions, or the names of your services.
- You cannot ship your internal product team a one-line install of a customized agent because the tools are SaaS, not libraries.

So somebody on the platform team decides to build an internal CLI agent. They start sketching it. The first week is consumed by:

- A text input that handles paste cleanly (multi-line, no rerendering on every keystroke).
- A markdown highlighter for streaming model output.
- An adapter that knows about Anthropic prompt caching because the bill matters.
- A slash command system because the team has fifteen recurring workflows.
- A theme so the CLI looks like company brand.
- Image clipboard support because designers paste screenshots into bug reports.
- Exponential backoff because the provider returns 5xx during peak hours.
- A scaffolder so other teams can stand up their own variant.

That week is the week vibecli takes back. `bunx @aflekkas/vibecli init my-internal-cli` produces a runnable Ink chat against an AI-SDK provider, with all of the above already wired up. The platform team's actual job — the OAuth flow, the internal RPC clients, the domain-specific system prompt, the internal tool registry — is what they touch. Everything else is already there as a primitive.

The same pattern applies to:

- A startup that wants a customer-support agent over their internal admin tools.
- A solo founder who wants a niche dev tool that wraps their own SaaS API.
- A research lab that wants a notebook-style agent over their own dataset.
- A consultant building a one-off deliverable for a client and shipping it as a pinned binary.
- A hobbyist who just wants a chat UI on top of their personal notes.

vibecli's bet is that this set of users is much larger than the set of users for any one closed agent product, and that the right shape for the toolkit is library, not platform.

## Files and folders are the API

The harness layer that vibecli encourages you to build leans heavily on a single principle: where there is a choice between a config schema and a filesystem convention, choose the filesystem.

The current expressions of this principle in the package:

- **Slash commands as `.md` files.** `markdown-dir` walks a directory of markdown files. `frontmatter` parses an optional `---` header. `commands` reserves a small set of names you cannot override. The result: a user can drop `~/.myapp/commands/deploy.md` into their home directory, restart the CLI, and now the agent knows about a `/deploy` command. Project commands at `./.myapp/commands/deploy.md` override user commands. The merge order is just a list. There is no JSON schema to validate, no plugin manifest, no registration ceremony.
- **Themes as objects in a registry.** `themes` ships six built-ins. `defineTheme({ accent })` derives a full theme from one color. Users can drop a `theme.ts` in their project, import `defineTheme`, and pass the result to `VibeConfigProvider`. No `tailwind.config.js`, no PostCSS plugin, no generator step.
- **Scenarios as scripted JSON.** `scenarios` runs a list of `{ input, expectContains | expectMatches }` steps against an agent and asserts on the assistant's text. Drop a `scenarios/foo.json` next to your CLI. Run it in CI. There is no test framework, no DSL, no stub harness.
- **Agent identity as a string.** The system prompt is just a string passed to `createAgent(provider, system, opts)`. Want to A/B different personas? Save them as `prompts/*.md` and pick at runtime. Want a different persona per command? Same answer.
- **Settings as a hierarchy of JSON files.** `settings` loads multiple files in order, deep-merges, and lets you specify per-key array policies (`concat`, `replace`, `dedupe`). The user's `~/.myapp/settings.json` and the project's `./.myapp/settings.json` and any others you list compose without ceremony.
- **Permissions as glob patterns.** `permissions` evaluates `tool.input.path` against allow/ask/deny patterns and returns a decision. Five modes (`bypassPermissions`, `allow`, `ask`, `deny`, `acceptEdits`). The pattern grammar is the one users already know from `.gitignore`.

Why this shape:

- **Discoverability.** A user who can run `ls` can see every command, theme, and prompt their agent has. A user who has a JSON config file has to read the schema.
- **Version control.** Files diff. Schemas drift. A `git log` on `~/.myapp/commands/` is the change history of your agent.
- **Copyability.** A user can fork another team's commands directory. They cannot fork another team's config schema entries without a migration.
- **Layerability.** The merge order between user, project, and team is just a list of directories. Adding a new layer is adding a new directory.
- **Zero learning curve.** There is no library to learn. The user already knows how to make a folder.

The boundary in `src/` is what makes this honest: the package itself does not assume any specific path, name, or directory layout. `markdown-dir` takes a list of `dirs`. `loadSettingsHierarchy` takes a list of `files`. `evaluatePermission` takes the rules. The primitives are generic. The conventions are yours.

## Customizable down to the metal

vibecli is a library, not a framework. That is a tradeoff with consequences:

- You write the loop's caller. `createAgent(provider, system, opts).send(input)` returns an async iterable. You decide what to do with each event.
- You write the input handler. `<TextInput>` calls `onSubmit(text)` with whatever the user typed. You decide what to do with it.
- You write the slash dispatcher. `createSlashRegistry()` is chainable and explicit. Or use `markdown-dir`. Or write your own.
- You write the tool runners. `agent` calls them with the typed input. You decide whether to confirm, log, or sandbox.
- You write the rendering. `chat` ships `<MessageList>` for the common case. You can also iterate the events yourself and render whatever you want.

The contrast with closed agent runtimes is sharp. Closed runtimes ship one chat shape, one set of slash commands, one tool surface, one permissions model, one provider, and one branding. The product decisions are made for you. vibecli ships none of those product decisions. The package surface is functions and React components. Everything that looks like a product decision in the in-tree `templates/playground/` is by definition demo wiring, not library API. You take the parts you want and drop the rest.

The cost is that you have to build a product. The benefit is that the product is yours.

## Where this is going

A natural next primitive is multi-agent coordination. Real internal CLI agents will want a planner agent that hands off to specialist agents, a supervisor agent that watches a long-running task, and an inspector agent that audits another agent's tool calls before they execute. Each of those is, again, just a loop with disciplined IO around it. The shape of the primitive is something like a typed message bus and a registry of named agents, where any agent can `send_to(other_agent, message)` and `await_reply()`. Pre-alpha — direction, not commitment. Treat this paragraph as a sketch of how the thesis extends, not a roadmap promise.

## What vibecli is not

It is worth being explicit about the anti-thesis.

- **vibecli is not a framework.** There is no inversion of control, no required base class, no plugin manifest, no lifecycle that you must hook into. The primitives are pure functions and React components. You compose, you do not extend.
- **vibecli is not a product.** It is not a chat application, an IDE plugin, a SaaS, or a hosted agent. The in-tree `templates/playground/` is a demo, not a product surface.
- **vibecli is not opinionated about your domain.** It does not assume you are building a coding agent, a customer-support agent, a notes assistant, or anything specific. The primitives stay generic.
- **vibecli is not a closed agent runtime.** It does not own your loop, your tools, your permissions, or your data. The package never phones home, never collects telemetry, and never ships a daemon.
- **vibecli is not Langchain.** No abstract chain, no abstract memory, no abstract retriever, no abstract anything. The model is "pass typed structures to small functions and read back typed structures." If you want an abstraction layer over many providers, the Vercel AI SDK is one floor below; vibecli sits on top of it.
- **vibecli is not stable.** Pre-alpha. The API moves between patch versions. The post-publish smoke test is the only guarantee that any one release is internally consistent. Pin a version, expect breakage on minor bumps, and read the release notes.

## Why the whole stack is open

This package is built with its own claude-code-native scaffolding — the agents, skills, and slash commands under [`.claude/`](.claude/) and the [`CLAUDE.md`](./CLAUDE.md) orchestrator. That scaffolding is committed and shipped publicly on purpose.

The reason: the package is a library *for building agent CLIs*, and the most useful documentation of how to build one is the working example of how this one was built. If you scaffold a project with `vibecli init`, you can also `cp -r .claude/` from this repo into your own and inherit a full vibecode-then-promote workflow. The agents and skills are not framework-specific; they encode practices like "ship a post-publish smoke test on every release" and "keep the boundary between library and consumer explicit." Those practices are the actual product.

Pre-alpha is also why the stack is open. The API will move. Treating every change as breaking until proven otherwise means the contributor and the consumer want the same thing: visibility into how the package is actually built, not a polished surface that hides the churn.

---

← [README](./README.md) · [thesis](./THESIS.md) · [cli](./docs/cli.md) · [configuration](./docs/configuration.md)
