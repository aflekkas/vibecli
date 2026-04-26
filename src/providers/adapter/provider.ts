import { jsonSchema, stepCountIs, streamText, tool, type LanguageModel, type ModelMessage } from "ai";
import { withRetry, type RetryOpts } from "../../retry.ts";
import type { Message, Provider, StreamEvent, ToolDef } from "../types.ts";
import { findSecondToLastUserIdx, toModelMessages } from "./messages.ts";

export type AdapterJsonValue =
  | string
  | number
  | boolean
  | null
  | AdapterJsonValue[]
  | { [key: string]: AdapterJsonValue };

export type AdapterProviderOptions = Record<string, Record<string, AdapterJsonValue>>;

export type AdapterOpts = {
  name: string;
  model: string;
  languageModel: LanguageModel;
  sessionId?: string;
  retry?: RetryOpts;
  providerOptions?:
    | AdapterProviderOptions
    | ((ctx: { name: string; model: string; sessionId: string }) => AdapterProviderOptions | undefined);
  maxOutputTokens?: number | false;
  anthropic?: {
    cacheControl?: boolean;
    thinking?: Record<string, AdapterJsonValue> | false;
    maxOutputTokens?: number | false;
  };
  openai?: {
    promptCacheKey?: string | false;
    user?: string | false;
  };
};

export class AiSdkProvider implements Provider {
  name: string;
  model: string;
  private lm: LanguageModel;
  private sessionId: string;
  private retry?: RetryOpts;
  private providerOptions?: AdapterOpts["providerOptions"];
  private maxOutputTokens?: number | false;
  private anthropic: NonNullable<AdapterOpts["anthropic"]>;
  private openai: NonNullable<AdapterOpts["openai"]>;

  constructor(opts: AdapterOpts) {
    this.name = opts.name;
    this.model = opts.model;
    this.lm = opts.languageModel;
    this.sessionId = opts.sessionId ?? crypto.randomUUID();
    this.retry = opts.retry;
    this.providerOptions = opts.providerOptions;
    this.maxOutputTokens = opts.maxOutputTokens;
    this.anthropic = opts.anthropic ?? {};
    this.openai = opts.openai ?? {};
  }

  async *stream(opts: {
    system: string;
    messages: Message[];
    tools: ToolDef[];
    signal?: AbortSignal;
  }): AsyncIterable<StreamEvent> {
    const isAnthropic = this.name === "anthropic";
    const isOpenAI = this.name === "openai";
    const useAnthropicCache = isAnthropic && this.anthropic.cacheControl !== false;

    const cacheUserIdx = useAnthropicCache ? findSecondToLastUserIdx(opts.messages) : -1;

    const modelMessages: ModelMessage[] = [
      {
        role: "system",
        content: opts.system,
        ...(useAnthropicCache
          ? { providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }
          : {}),
      },
      ...toModelMessages(opts.messages, { anthropicCacheUserIdx: cacheUserIdx }),
    ];

    const tools = Object.fromEntries(
      opts.tools.map((t) => [
        t.name,
        tool({
          description: t.description,
          inputSchema: jsonSchema(t.input_schema as any),
        }),
      ]),
    );

    const defaultProviderOptions: AdapterProviderOptions = {};
    if (isAnthropic && this.anthropic.thinking !== false) {
      defaultProviderOptions.anthropic = {
        thinking: this.anthropic.thinking ?? { type: "adaptive" },
      };
    }
    if (isOpenAI) {
      const openaiOptions: Record<string, AdapterJsonValue> = {};
      if (this.openai.promptCacheKey !== false) {
        openaiOptions.promptCacheKey = this.openai.promptCacheKey ?? this.sessionId;
      }
      if (this.openai.user !== false) {
        openaiOptions.user = this.openai.user ?? `vibecli-${this.sessionId}`;
      }
      if (Object.keys(openaiOptions).length) defaultProviderOptions.openai = openaiOptions;
    }
    const providerOptions = mergeProviderOptions(defaultProviderOptions, this.resolveProviderOptions());

    let maxOutputTokens: number | undefined;
    if (this.maxOutputTokens !== false && this.maxOutputTokens != null) {
      maxOutputTokens = this.maxOutputTokens;
    } else if (this.maxOutputTokens !== false && isAnthropic && this.anthropic.maxOutputTokens !== false) {
      maxOutputTokens = this.anthropic.maxOutputTokens ?? 8192;
    }

    const result = await withRetry(() =>
      Promise.resolve(
        streamText({
          model: this.lm,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(1),
          abortSignal: opts.signal,
          providerOptions,
          ...(maxOutputTokens != null ? { maxOutputTokens } : {}),
        }),
      ),
      this.retry,
    );

    let stopReason = "end_turn";
    let usage: { input: number; output: number; cacheRead?: number } | undefined;

    try {
      for await (const chunk of result.fullStream) {
        if (opts.signal?.aborted) break;
        switch (chunk.type) {
          case "text-delta":
            yield { type: "text_delta", text: (chunk as any).text ?? (chunk as any).delta ?? "" };
            break;
          case "reasoning-delta":
            yield { type: "thinking_delta", text: (chunk as any).text ?? (chunk as any).delta ?? "" };
            break;
          case "tool-call":
            yield {
              type: "tool_call",
              call: {
                id: chunk.toolCallId,
                name: chunk.toolName,
                input: (chunk.input ?? {}) as Record<string, unknown>,
              },
            };
            break;
          case "finish-step":
          case "finish": {
            const anyC = chunk as any;
            const reason = anyC.finishReason;
            if (reason) {
              stopReason = reason === "tool-calls" ? "tool_use" : reason === "stop" ? "end_turn" : reason;
            }
            const u = anyC.usage ?? anyC.totalUsage;
            if (u) {
              usage = {
                input: u.inputTokens ?? 0,
                output: u.outputTokens ?? 0,
                cacheRead: u.cachedInputTokens ?? 0,
              };
            }
            break;
          }
          case "error": {
            const err = (chunk as any).error;
            throw err instanceof Error ? err : new Error(String(err));
          }
        }
      }
    } catch (e: any) {
      if (opts.signal?.aborted || e?.name === "AbortError") {
        yield { type: "done", stopReason: "aborted", usage };
        return;
      }
      throw e;
    }

    yield { type: "done", stopReason, usage };
  }

  private resolveProviderOptions(): AdapterProviderOptions | undefined {
    if (!this.providerOptions) return undefined;
    if (typeof this.providerOptions !== "function") return this.providerOptions;
    return this.providerOptions({
      name: this.name,
      model: this.model,
      sessionId: this.sessionId,
    });
  }
}

function mergeProviderOptions(
  ...sources: (AdapterProviderOptions | undefined)[]
): AdapterProviderOptions | undefined {
  const merged: AdapterProviderOptions = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [provider, options] of Object.entries(source)) {
      merged[provider] = { ...(merged[provider] ?? {}), ...options };
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}
