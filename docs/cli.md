# CLI

The package ships a small `vibecli` binary for starting an Ink project that already uses vibecli primitives.

```bash
bunx @aflekkas/vibecli init my-cli
```

Options:

```bash
vibecli init [dir] [--name <name>] [--pm bun|npm] [--vibecli <version>] [--force]
```

The generated app includes:

- `package.json`
- `tsconfig.json`
- `src/index.tsx`
- `.gitignore`
- `README.md`

The starter imports from `@aflekkas/vibecli/text-input` and `@aflekkas/vibecli/ui`, so it only depends on the UI subpaths it uses. It intentionally does not generate provider keys, runtime artifact paths, app commands, or tool names.

For local smoke testing before a release, pass a package spec explicitly:

```bash
bun run src/cli.ts init ../vibecli-playground --vibecli file:../vibecli --force
```
