# CLI

The package ships a small `vibecli` binary with two subcommands: `init` (scaffold a fresh Ink + AI SDK agent CLI) and `mcp` (run a local stdio MCP docs server).

## `vibecli init`

```bash
bunx @aflekkas/vibecli init my-cli
```

Full signature:

```bash
vibecli init [dir] [--name <name>] [--pm bun|npm] [--vibecli <version>] [--theme <name>] [--no-prompt] [--no-install] [--force]
```

| Flag | Default | Effect |
|---|---|---|
| `[dir]` | `vibecli-app` | Target directory. Created if missing. |
| `--name <name>` | basename of `dir` | `package.json` `name` field for the generated project. |
| `--pm bun\|npm` | `bun` | Package manager used for the generated `scripts.dev` and the post-scaffold install. |
| `--vibecli <version>` | local package version | Version of `@aflekkas/vibecli` pinned in the generated `package.json`. Use `latest` or `file:../vibecli` for local smoke. |
| `--theme <name>` | interactive prompt | Pre-select a built-in theme. Names: `pink`, `ocean`, `matrix`, `amber`, `claude`, `mono`. |
| `--no-prompt` | off | Skip the interactive theme prompt; use the first theme (or `--theme` if given). |
| `--no-install` | off | Skip running `bun install` / `npm install` after writing files. |
| `--force` | off | Overwrite existing files in `dir` instead of refusing. |

The generated app includes:

- `package.json`
- `tsconfig.json`
- `src/index.tsx` (chat loop wired to `@ai-sdk/anthropic`, `<TextInput>`, `<ThemePicker>`, `createAgent`, the chosen theme)
- `.env.example`
- `.gitignore`
- `README.md`

The scaffold imports only from `@aflekkas/vibecli/text-input`, `/ui`, `/config`, `/themes`, `/theme-picker`, `/providers/adapter`, and `/agent` — no consumer-specific names, no runtime artifact paths, no preset slash commands beyond `/theme`.

For local smoke testing before a release:

```bash
bun run src/cli.ts init ../vibecli-playground --vibecli file:../vibecli --force --no-prompt
```

## `vibecli mcp`

Local stdio MCP server that exposes this package's README, `docs/*.md`, and `package.json` `exports` map as MCP resources + tools. Spawned by an MCP-capable client (Claude Code, Cursor, mcp-inspector); it streams MCP messages over stdin/stdout and exits when the client disconnects. No network, no daemon.

```bash
claude mcp add vibecli -- bunx @aflekkas/vibecli mcp
```

Resources: `vibecli://readme`, `vibecli://docs/configuration`, `vibecli://docs/cli`, `vibecli://exports`.

Tools: `list_subpaths` (every importable subpath with a one-line summary), `get_subpath_docs({ name })` (per-subpath summary, canonical import statement, README example pointer).

The docs version equals the package version. `bun update @aflekkas/vibecli` is also a docs bump for any agent connected to the server.
