import type { ContentBlock, Message, Provider, ToolDef } from "./providers/types.ts";

export type ToolHandler = (input: Record<string, unknown>) => Promise<string> | string;

export type ToolEntry = { def: ToolDef; run: ToolHandler };

export type TurnUsage = { input: number; output: number; cacheRead?: number };

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; output: string }
  | { type: "turn_done"; usage?: TurnUsage }
  | { type: "truncated"; count: number }
  | { type: "compacted"; messagesBefore: number; messagesAfter: number; summaryTokens?: number }
  | { type: "aborted" }
  | { type: "error"; message: string };

export type LifecycleEvent = "pre_turn" | "post_turn" | "pre_tool" | "post_tool";

export type LifecycleContext = {
  status?: "ok" | "aborted" | "error";
  provider?: string;
  model?: string;
  tool?: string;
  input?: string;
  output?: string;
  mode?: string;
};

export type LifecycleResult = void | { allow: false; reason?: string };

export type AgentOptions = {
  tools?: ToolEntry[];
  contextWindow?: number;
  compactAt?: number;
  compactKeep?: number;
  truncateKeep?: number;
  iterationCap?: number;
  onLifecycle?: (
    event: LifecycleEvent,
    ctx: LifecycleContext,
  ) => LifecycleResult | Promise<LifecycleResult>;
  /**
   * Informational permission/operating mode. Surfaced to lifecycle ctx as `ctx.mode`.
   * vibecli does not interpret this value. The consumer's `onLifecycle` decides whether
   * to block tool calls based on it. Common values: "default", "plan", "acceptEdits",
   * "auto", "bypass", but any string is accepted.
   */
  mode?: string;
};

export type AgentState = {
  messages: Message[];
};

export type Agent = {
  send: (
    userInput: string | ContentBlock[],
    sendOpts?: { signal?: AbortSignal },
  ) => AsyncGenerator<AgentEvent>;
  state: AgentState;
  setSystem: (s: string) => void;
  setProvider: (p: Provider) => void;
  getProvider: () => Provider;
};

type CompactOpts = {
  contextWindow: number;
  compactAt: number;
  compactKeep: number;
  usage: TurnUsage | undefined;
};

type CompactResult =
  | { event: AgentEvent; replaced: true }
  | { event: AgentEvent; replaced: false };

async function compactMessages(
  provider: Provider,
  system: string,
  state: AgentState,
  opts: CompactOpts,
): Promise<CompactResult | null> {
  const { contextWindow, compactAt, compactKeep, usage } = opts;
  if (!contextWindow || !usage || typeof usage.input !== "number") return null;
  if (usage.input / contextWindow <= compactAt) return null;

  const messagesBefore = state.messages.length;
  const cutoff = Math.max(0, state.messages.length - compactKeep);
  const olderMessages = state.messages.slice(0, cutoff);
  const recentTurns = state.messages.slice(cutoff);
  if (olderMessages.length === 0) return null;

  const synthesisPrompt: Message = {
    role: "user",
    content:
      "Summarize the conversation above in about 500 tokens. Preserve: decisions made, open questions, files/paths touched, current goal. Output only the summary, no preamble.",
  };

  let summary = "";
  let summaryTokens: number | undefined;
  try {
    for await (const ev of provider.stream({
      system,
      messages: [...olderMessages, synthesisPrompt],
      tools: [],
    })) {
      if (ev.type === "text_delta") {
        summary += ev.text;
      } else if (ev.type === "done") {
        summaryTokens = ev.usage?.output;
      }
    }
  } catch (e: any) {
    return {
      event: { type: "error", message: `compaction failed: ${e.message || String(e)}` },
      replaced: false,
    };
  }

  state.messages = [
    { role: "user", content: "<context-summary>\n" + summary + "\n</context-summary>" },
    { role: "assistant", content: "Got it, continuing from that summary." },
    ...recentTurns,
  ];

  return {
    event: {
      type: "compacted",
      messagesBefore,
      messagesAfter: state.messages.length,
      summaryTokens,
    },
    replaced: true,
  };
}

function truncateOldToolResults(messages: Message[], keep: number): number {
  const cutoff = Math.max(0, messages.length - keep);
  let count = 0;
  for (let i = 0; i < cutoff; i++) {
    const msg = messages[i];
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type !== "tool_result") continue;
      if (typeof block.content !== "string") continue;
      if (block.content.startsWith("[truncated ")) continue;
      const originalLength = block.content.length;
      block.content = `[truncated ${originalLength} chars]`;
      count++;
    }
  }
  return count;
}

export function createAgent(initialProvider: Provider, system: string, opts: AgentOptions = {}): Agent {
  const state: AgentState = { messages: [] };
  let currentSystem = system;
  let provider = initialProvider;
  const tools = opts.tools ?? [];
  const toolDefs: ToolDef[] = tools.map((t) => t.def);
  const toolMap: Record<string, ToolHandler> = Object.fromEntries(tools.map((t) => [t.def.name, t.run]));
  const compactAt = opts.compactAt ?? 0.75;
  const compactKeep = opts.compactKeep ?? 8;
  const truncateKeep = opts.truncateKeep ?? 8;
  const iterationCap = opts.iterationCap ?? 20;
  const onLifecycle = opts.onLifecycle;

  async function fire(event: LifecycleEvent, ctx: LifecycleContext): Promise<LifecycleResult> {
    if (!onLifecycle) return;
    try {
      return await onLifecycle(event, ctx);
    } catch {
      // Lifecycle hook errors must not break the agent loop.
      return;
    }
  }

  async function* send(
    userInput: string | ContentBlock[],
    sendOpts: { signal?: AbortSignal } = {},
  ): AsyncGenerator<AgentEvent> {
    const signal = sendOpts.signal;
    state.messages.push({ role: "user", content: userInput });
    await fire("pre_turn", { provider: provider.name, model: provider.model, mode: opts.mode });

    for (let iter = 0; iter < iterationCap; iter++) {
      if (signal?.aborted) {
        yield { type: "aborted" };
        await fire("post_turn", { status: "aborted", mode: opts.mode });
        return;
      }

      const truncatedCount = truncateOldToolResults(state.messages, truncateKeep);
      if (truncatedCount > 0) {
        yield { type: "truncated", count: truncatedCount };
      }

      const assistantBlocks: ContentBlock[] = [];
      let textBuf = "";
      const toolCalls: { id: string; name: string; input: Record<string, unknown> }[] = [];
      let stopReason = "end_turn";
      let usage: TurnUsage | undefined;

      try {
        for await (const ev of provider.stream({
          system: currentSystem,
          messages: state.messages,
          tools: toolDefs,
          signal,
        })) {
          if (ev.type === "text_delta") {
            textBuf += ev.text;
            yield { type: "text", text: ev.text };
          } else if (ev.type === "thinking_delta") {
            yield { type: "thinking", text: ev.text };
          } else if (ev.type === "tool_call") {
            toolCalls.push(ev.call);
          } else if (ev.type === "done") {
            stopReason = ev.stopReason;
            usage = ev.usage;
          }
        }
      } catch (e: any) {
        if (signal?.aborted || e?.name === "AbortError") {
          yield { type: "aborted" };
          await fire("post_turn", { status: "aborted", mode: opts.mode });
          return;
        }
        yield { type: "error", message: e.message || String(e) };
        await fire("post_turn", { status: "error", mode: opts.mode });
        return;
      }

      if (textBuf) assistantBlocks.push({ type: "text", text: textBuf });
      for (const c of toolCalls) {
        assistantBlocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      }
      state.messages.push({ role: "assistant", content: assistantBlocks });

      if (toolCalls.length === 0 || stopReason === "end_turn" || stopReason === "stop") {
        yield { type: "turn_done", usage };
        await fire("post_turn", { status: "ok", mode: opts.mode });

        if (opts.contextWindow) {
          const result = await compactMessages(provider, currentSystem, state, {
            contextWindow: opts.contextWindow,
            compactAt,
            compactKeep,
            usage,
          });
          if (result) {
            yield result.event;
            if (!result.replaced) return;
          }
        }
        return;
      }

      const results: ContentBlock[] = [];
      for (const call of toolCalls) {
        if (signal?.aborted) {
          yield { type: "aborted" };
          await fire("post_turn", { status: "aborted", mode: opts.mode });
          return;
        }
        yield { type: "tool_start", name: call.name, input: call.input };
        const handler = toolMap[call.name];
        const toolInputJson = (() => {
          try {
            return JSON.stringify(call.input);
          } catch {
            return "";
          }
        })();
        const preToolResult = await fire("pre_tool", {
          tool: call.name,
          input: toolInputJson.slice(0, 4000),
          mode: opts.mode,
        });
        let output: string;
        if (preToolResult && preToolResult.allow === false) {
          output = `error: blocked by pre_tool hook${preToolResult.reason ? ": " + preToolResult.reason : ""}`;
          yield { type: "tool_end", name: call.name, output };
          await fire("post_tool", {
            tool: call.name,
            input: toolInputJson.slice(0, 4000),
            output,
            mode: opts.mode,
          });
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: output,
            tool_name: call.name,
          });
          continue;
        }
        if (!handler) {
          output = `error: unknown tool ${call.name}`;
        } else {
          try {
            output = await handler(call.input);
          } catch (e: any) {
            output = `error: ${e.message}`;
          }
        }
        yield { type: "tool_end", name: call.name, output };
        await fire("post_tool", {
          tool: call.name,
          input: toolInputJson.slice(0, 4000),
          output: output.slice(0, 2000),
          mode: opts.mode,
        });
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: output,
          tool_name: call.name,
        });
      }
      state.messages.push({ role: "user", content: results });
    }

    yield { type: "error", message: `hit ${iterationCap} iteration limit` };
  }

  function setSystem(s: string) {
    currentSystem = s;
  }

  function setProvider(p: Provider) {
    provider = p;
  }

  function getProvider(): Provider {
    return provider;
  }

  return { send, state, setSystem, setProvider, getProvider };
}
