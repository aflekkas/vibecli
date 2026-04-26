import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ToolEntry } from "@aflekkas/vibecli/agent";

const MAX_OUTPUT = 8000;

function truncate(s: string, max = MAX_OUTPUT): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n[... truncated ${s.length - max} chars]`;
}

function safeResolve(cwd: string, p: string): string {
  const abs = isAbsolute(p) ? p : resolve(cwd, p);
  const rel = relative(cwd, abs);
  if (rel.startsWith("..")) {
    throw new Error(`path escapes working directory: ${p}`);
  }
  return abs;
}

function runBash(cmd: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise) => {
    const child = spawn("bash", ["-lc", cmd], { cwd, env: process.env });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const parts: string[] = [];
      if (out) parts.push(out);
      if (err) parts.push(`[stderr]\n${err}`);
      parts.push(`[exit ${signal ?? code ?? 0}]`);
      resolvePromise(truncate(parts.join("\n")));
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolvePromise(`error: ${e.message}`);
    });
  });
}

export function buildTools(cwd: string = process.cwd()): ToolEntry[] {
  return [
    {
      def: {
        name: "bash",
        description:
          "Run a bash command in the project working directory. Returns stdout, stderr, and exit code. 30s timeout.",
        input_schema: {
          type: "object",
          properties: {
            command: { type: "string", description: "Shell command to execute" },
          },
          required: ["command"],
        },
      },
      run: async (input) => {
        const command = String(input.command ?? "");
        if (!command.trim()) return "error: empty command";
        return runBash(command, cwd, 30_000);
      },
    },
    {
      def: {
        name: "read_file",
        description: "Read a UTF-8 text file from the working directory.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path relative to cwd (or absolute within cwd)" },
          },
          required: ["path"],
        },
      },
      run: async (input) => {
        const p = String(input.path ?? "");
        if (!p) return "error: missing path";
        try {
          const abs = safeResolve(cwd, p);
          const content = await readFile(abs, "utf8");
          return truncate(content);
        } catch (e: any) {
          return `error: ${e.message}`;
        }
      },
    },
    {
      def: {
        name: "write_file",
        description: "Write UTF-8 text to a file in the working directory. Creates parent dirs.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path relative to cwd" },
            content: { type: "string", description: "Full file contents to write" },
          },
          required: ["path", "content"],
        },
      },
      run: async (input) => {
        const p = String(input.path ?? "");
        const content = String(input.content ?? "");
        if (!p) return "error: missing path";
        try {
          const abs = safeResolve(cwd, p);
          await mkdir(dirname(abs), { recursive: true });
          await writeFile(abs, content, "utf8");
          return `wrote ${content.length} chars to ${relative(cwd, abs)}`;
        } catch (e: any) {
          return `error: ${e.message}`;
        }
      },
    },
    {
      def: {
        name: "glob",
        description:
          "List files matching a glob pattern in the working directory. Returns up to 200 paths.",
        input_schema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: 'Glob, e.g. "src/**/*.ts"' },
          },
          required: ["pattern"],
        },
      },
      run: async (input) => {
        const pattern = String(input.pattern ?? "");
        if (!pattern) return "error: missing pattern";
        try {
          const BunGlobal: any = (globalThis as any).Bun;
          const GlobCtor = BunGlobal?.Glob;
          if (!GlobCtor) return "error: glob requires bun runtime (Bun.Glob unavailable)";
          const g = new GlobCtor(pattern);
          const matches: string[] = [];
          for await (const m of g.scan({ cwd, dot: false })) {
            matches.push(m);
            if (matches.length >= 200) break;
          }
          if (matches.length === 0) return "(no matches)";
          return matches.join("\n");
        } catch (e: any) {
          return `error: ${e.message}`;
        }
      },
    },
  ];
}
