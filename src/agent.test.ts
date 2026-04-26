import { describe, expect, test } from "bun:test";
import { createAgent, type LifecycleEvent, type LifecycleContext, type LifecycleResult } from "./agent.ts";
import type { Provider, StreamEvent, ToolDef } from "./providers/types.ts";

const noopToolDef: ToolDef = {
  name: "danger",
  description: "test tool that should not run when blocked",
  input_schema: { type: "object", properties: {} },
};

const otherToolDef: ToolDef = {
  name: "safe",
  description: "test tool that runs after a block",
  input_schema: { type: "object", properties: {} },
};

function makeProvider(events: StreamEvent[][]): Provider {
  let turn = 0;
  return {
    name: "stub",
    model: "stub-model",
    async *stream() {
      const batch = events[turn++] ?? [{ type: "done", stopReason: "end_turn" }];
      for (const ev of batch) yield ev;
    },
  };
}

async function drain(gen: AsyncGenerator<any>) {
  const out: any[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

describe("agent lifecycle blocking", () => {
  test("pre_tool returning allow:false blocks handler from running", async () => {
    let ran = false;
    const provider = makeProvider([
      [
        { type: "tool_call", call: { id: "c1", name: "danger", input: {} } },
        { type: "done", stopReason: "tool_use" },
      ],
      [{ type: "done", stopReason: "end_turn" }],
    ]);
    const agent = createAgent(provider, "sys", {
      tools: [
        {
          def: noopToolDef,
          run: () => {
            ran = true;
            throw new Error("should not have been called");
          },
        },
      ],
      onLifecycle: (event): LifecycleResult => {
        if (event === "pre_tool") return { allow: false, reason: "nope" };
        return;
      },
    });
    await drain(agent.send("hi"));
    expect(ran).toBe(false);
  });

  test("blocked tool yields tool_end carrying the reason", async () => {
    const provider = makeProvider([
      [
        { type: "tool_call", call: { id: "c1", name: "danger", input: {} } },
        { type: "done", stopReason: "tool_use" },
      ],
      [{ type: "done", stopReason: "end_turn" }],
    ]);
    const agent = createAgent(provider, "sys", {
      tools: [
        {
          def: noopToolDef,
          run: () => "should never see this",
        },
      ],
      onLifecycle: (event): LifecycleResult => {
        if (event === "pre_tool") return { allow: false, reason: "policy says no" };
        return;
      },
    });
    const events = await drain(agent.send("hi"));
    const toolEnd = events.find((e) => e.type === "tool_end");
    expect(toolEnd).toBeDefined();
    expect(toolEnd.name).toBe("danger");
    expect(toolEnd.output).toContain("blocked by pre_tool hook");
    expect(toolEnd.output).toContain("policy says no");
  });

  test("post_tool fires after a blocked call", async () => {
    const fired: LifecycleEvent[] = [];
    const provider = makeProvider([
      [
        { type: "tool_call", call: { id: "c1", name: "danger", input: {} } },
        { type: "done", stopReason: "tool_use" },
      ],
      [{ type: "done", stopReason: "end_turn" }],
    ]);
    const agent = createAgent(provider, "sys", {
      tools: [{ def: noopToolDef, run: () => "x" }],
      onLifecycle: (event): LifecycleResult => {
        fired.push(event);
        if (event === "pre_tool") return { allow: false, reason: "blocked" };
        return;
      },
    });
    await drain(agent.send("hi"));
    expect(fired).toContain("pre_tool");
    expect(fired).toContain("post_tool");
    const preIdx = fired.indexOf("pre_tool");
    const postIdx = fired.indexOf("post_tool");
    expect(postIdx).toBeGreaterThan(preIdx);
  });

  test("each tool call gates independently within the same turn", async () => {
    const calls: string[] = [];
    const provider = makeProvider([
      [
        { type: "tool_call", call: { id: "c1", name: "danger", input: {} } },
        { type: "tool_call", call: { id: "c2", name: "safe", input: {} } },
        { type: "done", stopReason: "tool_use" },
      ],
      [{ type: "done", stopReason: "end_turn" }],
    ]);
    const agent = createAgent(provider, "sys", {
      tools: [
        {
          def: noopToolDef,
          run: () => {
            calls.push("danger");
            return "ran danger";
          },
        },
        {
          def: otherToolDef,
          run: () => {
            calls.push("safe");
            return "ran safe";
          },
        },
      ],
      onLifecycle: (event, ctx): LifecycleResult => {
        if (event === "pre_tool" && ctx.tool === "danger") {
          return { allow: false, reason: "danger blocked" };
        }
        return;
      },
    });
    const events = await drain(agent.send("hi"));
    expect(calls).toEqual(["safe"]);
    const ends = events.filter((e) => e.type === "tool_end");
    expect(ends).toHaveLength(2);
    expect(ends[0].output).toContain("blocked by pre_tool hook");
    expect(ends[1].output).toBe("ran safe");
  });

  test("opts.mode is propagated to lifecycle context", async () => {
    const seen: Array<{ event: LifecycleEvent; mode?: string }> = [];
    const provider = makeProvider([
      [
        { type: "tool_call", call: { id: "c1", name: "safe", input: {} } },
        { type: "done", stopReason: "tool_use" },
      ],
      [{ type: "done", stopReason: "end_turn" }],
    ]);
    const agent = createAgent(provider, "sys", {
      mode: "plan",
      tools: [{ def: otherToolDef, run: () => "ok" }],
      onLifecycle: (event, ctx) => {
        seen.push({ event, mode: ctx.mode });
      },
    });
    await drain(agent.send("hi"));
    for (const entry of seen) {
      expect(entry.mode).toBe("plan");
    }
    const events = seen.map((s) => s.event);
    expect(events).toContain("pre_turn");
    expect(events).toContain("pre_tool");
    expect(events).toContain("post_tool");
    expect(events).toContain("post_turn");
  });

  test("void-returning lifecycle callbacks remain supported", async () => {
    let ran = false;
    const provider = makeProvider([
      [
        { type: "tool_call", call: { id: "c1", name: "safe", input: {} } },
        { type: "done", stopReason: "tool_use" },
      ],
      [{ type: "done", stopReason: "end_turn" }],
    ]);
    const agent = createAgent(provider, "sys", {
      tools: [
        {
          def: otherToolDef,
          run: () => {
            ran = true;
            return "ok";
          },
        },
      ],
      onLifecycle: (_event: LifecycleEvent, _ctx: LifecycleContext): LifecycleResult => {
        // returns void
      },
    });
    const events = await drain(agent.send("hi"));
    expect(ran).toBe(true);
    const toolEnd = events.find((e) => e.type === "tool_end");
    expect(toolEnd?.output).toBe("ok");
  });
});
