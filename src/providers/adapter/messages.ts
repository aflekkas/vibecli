import type { ModelMessage } from "ai";
import type { Message } from "../types.ts";

export function findSecondToLastUserIdx(messages: Message[]): number {
  const userIdxs: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const r = messages[i]!.role;
    if (r === "user" || r === "tool") userIdxs.push(i);
  }
  return userIdxs.length >= 2 ? userIdxs[userIdxs.length - 2]! : -1;
}

export function toModelMessages(
  msgs: Message[],
  opts: { anthropicCacheUserIdx: number },
): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    const stampCache = i === opts.anthropicCacheUserIdx;

    if (typeof m.content === "string") {
      if (m.role === "assistant") {
        out.push({ role: "assistant", content: m.content });
      } else {
        out.push({
          role: "user",
          content: stampCache
            ? [
                {
                  type: "text",
                  text: m.content,
                  providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
                },
              ]
            : m.content,
        });
      }
      continue;
    }

    if (m.role === "assistant") {
      const parts: any[] = [];
      for (const b of m.content) {
        if (b.type === "text") parts.push({ type: "text", text: b.text });
        else if (b.type === "tool_use") {
          parts.push({
            type: "tool-call",
            toolCallId: b.id,
            toolName: b.name,
            input: b.input,
          });
        }
      }
      if (parts.length) out.push({ role: "assistant", content: parts });
      continue;
    }

    const toolResults = m.content.filter((b) => b.type === "tool_result") as Extract<
      (typeof m.content)[number],
      { type: "tool_result" }
    >[];
    const others = m.content.filter((b) => b.type !== "tool_result");

    if (toolResults.length) {
      out.push({
        role: "tool",
        content: toolResults.map((b, idx) => {
          const isLast = idx === toolResults.length - 1;
          return {
            type: "tool-result",
            toolCallId: b.tool_use_id,
            toolName: b.tool_name ?? "unknown",
            output: { type: "text", value: b.content },
            ...(b.is_error ? { isError: true } : {}),
            ...(stampCache && isLast
              ? { providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }
              : {}),
          } as any;
        }),
      });
    }

    if (others.length) {
      const parts: any[] = [];
      for (let j = 0; j < others.length; j++) {
        const b = others[j]!;
        const isLast = j === others.length - 1;
        const stamp = stampCache && isLast && !toolResults.length;
        if (b.type === "text") {
          parts.push({
            type: "text",
            text: b.text,
            ...(stamp
              ? { providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }
              : {}),
          });
        } else if (b.type === "image") {
          parts.push({
            type: "image",
            image: b.data,
            mediaType: b.mediaType,
          });
        }
      }
      if (parts.length) out.push({ role: "user", content: parts });
    }
  }
  return out;
}
