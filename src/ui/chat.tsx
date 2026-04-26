import React from "react";
import { Box, Text } from "ink";
import { useVibeConfig, type MessageRole } from "./ui-config.tsx";
import type { Agent, AgentEvent } from "../agent.ts";
import type { ContentBlock } from "../providers/types.ts";

export type Turn = {
  role: MessageRole;
  text: string;
  id?: string;
};

export type UseAgentStreamOptions = {
  /**
   * Fires for every AgentEvent the loop produces (including `text` and
   * `error`, which the hook also reflects into `turns`). Use it to render
   * tool calls, token usage, abort/compaction notices as `meta` turns.
   */
  onEvent?: (ev: AgentEvent) => void;
  /**
   * Called once per `send()` just before the user message is pushed. Useful
   * for snapshotting `agent.state.messages` into a checkpoint history.
   */
  onBeforeSend?: (input: string | ContentBlock[]) => void;
};

export type UseAgentStreamResult = {
  turns: Turn[];
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>;
  send: (input: string | ContentBlock[]) => Promise<void>;
  reset: () => void;
  pushMeta: (text: string) => void;
  busy: boolean;
  abort: () => void;
};

/**
 * Drives an Agent over a turns array. Owns: streaming text accumulator into
 * the trailing assistant turn, busy flag, AbortController. Caller renders
 * `turns` (typically through <MessageList>) and calls `send` from a TextInput
 * submit handler. Pass `null` for `agent` while it's still being constructed —
 * `send` becomes a no-op until the agent is ready. Pass `onEvent` to handle
 * tool_start / tool_end / turn_done / aborted / compacted (the hook only
 * folds `text` and `error` into `turns` itself).
 */
export function useAgentStream(
  agent: Agent | null,
  opts: UseAgentStreamOptions = {},
): UseAgentStreamResult {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const pushMeta = React.useCallback((text: string) => {
    setTurns((t) => [...t, { role: "meta", text }]);
  }, []);

  const abort = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setTurns([]);
  }, []);

  const send = React.useCallback(
    async (input: string | ContentBlock[]) => {
      if (!agent) return;
      optsRef.current.onBeforeSend?.(input);
      const userText =
        typeof input === "string"
          ? input
          : input
              .map((b) => (b.type === "text" ? b.text : `[${b.type}]`))
              .join(" ");

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setTurns((t) => [
        ...t,
        { role: "user", text: userText },
        { role: "assistant", text: "" },
      ]);
      setBusy(true);
      try {
        for await (const ev of agent.send(input, { signal: ctrl.signal })) {
          optsRef.current.onEvent?.(ev);
          if (ev.type === "text") {
            setTurns((t) => {
              const next = t.slice();
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                next[next.length - 1] = { ...last, text: last.text + ev.text };
              }
              return next;
            });
          } else if (ev.type === "error") {
            setTurns((t) => [
              ...t,
              { role: "assistant", text: `error: ${ev.message}` },
            ]);
          }
        }
      } finally {
        setBusy(false);
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [agent],
  );

  return { turns, setTurns, send, reset, pushMeta, busy, abort };
}

export type MessageListProps = {
  turns: Turn[];
  prefix?: Partial<Record<MessageRole, string>>;
};

/**
 * Renders a list of conversation turns using styles from `useVibeConfig().messages.roles`.
 * Pass `prefix` to override the per-role label (defaults come from the config).
 */
export function MessageList({ turns, prefix }: MessageListProps) {
  const config = useVibeConfig();
  return (
    <Box flexDirection="column">
      {turns.map((t, i) => {
        const style = config.messages.roles[t.role];
        const label = prefix?.[t.role] ?? style.prefix;
        return (
          <Box key={t.id ?? i} flexDirection="column">
            <Text color={style.color} bold={style.bold} dimColor={style.dim}>
              {label}
              {t.text}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
