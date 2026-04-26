import { spawn } from "node:child_process";

export type StatusLinePayload = Record<string, unknown>;

export type StatusLineCommandOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  shell?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
};

export function firstStatusLine(text: string): string {
  return text.replace(/\r\n/g, "\n").split("\n")[0]?.trimEnd() ?? "";
}

export function truncateStatusLine(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return text.slice(0, width - 3) + "...";
}

/**
 * Spawns `command` via the login shell, writes `payload` as JSON to stdin,
 * and resolves with the first non-empty stdout line.
 *
 * Hard-kills the process after `timeoutMs` (default 300 ms) and resolves
 * with an empty string. Stdout is capped at `maxOutputBytes` (default 4096).
 * Stderr is ignored.
 */
export function runStatusLineCommand(
  command: string,
  payload: StatusLinePayload,
  options: StatusLineCommandOptions = {},
): Promise<string> {
  if (!command.trim()) return Promise.resolve("");
  const timeoutMs = options.timeoutMs ?? 300;
  const maxOutputBytes = options.maxOutputBytes ?? 4096;
  return new Promise((resolve) => {
    let done = false;
    let stdout = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const proc = spawn(options.shell ?? process.env.SHELL ?? "sh", ["-lc", command], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "ignore"],
    });
    const finish = (line: string) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve(line);
    };
    timer = setTimeout(() => {
      proc.kill("SIGTERM");
      finish("");
    }, timeoutMs);
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > maxOutputBytes) stdout = stdout.slice(0, maxOutputBytes);
    });
    proc.on("error", () => finish(""));
    proc.on("close", () => finish(firstStatusLine(stdout)));
    proc.stdin.end(JSON.stringify(payload) + "\n");
  });
}
