import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { TextInput } from "@aflekkas/vibecli/text-input";
import { GradientText } from "@aflekkas/vibecli/ui";
import { VibeConfigProvider, useVibeConfig } from "@aflekkas/vibecli/config";
import { themes, type ThemeName } from "@aflekkas/vibecli/themes";
import { ThemePicker } from "@aflekkas/vibecli/theme-picker";
import { AiSdkProvider } from "@aflekkas/vibecli/providers/adapter";
import { createAgent, type Agent } from "@aflekkas/vibecli/agent";
import { readClipboardImage } from "@aflekkas/vibecli/clipboard";
import { runScenario, type ScenarioStep } from "@aflekkas/vibecli/scenarios";
import { createCheckpointHistory } from "@aflekkas/vibecli/checkpoints";
import { useAgentStream, MessageList } from "@aflekkas/vibecli/chat";
import { defineModel, ModelPicker } from "@aflekkas/vibecli/models";
import { createSlashRegistry } from "@aflekkas/vibecli/slash";
import type { ContentBlock, Message, Provider } from "@aflekkas/vibecli/providers";
import { readFile } from "node:fs/promises";
import { buildTools } from "./tools.ts";

// Model registry. Add an entry to expose a new model in `/model`.
// To add Google: `bun add @ai-sdk/google`, import `google`, push another defineModel({...}).
function aiSdk(providerName: string, modelId: string, factory: (id: string) => any): Provider {
  return new AiSdkProvider({
    name: providerName,
    model: modelId,
    languageModel: factory(modelId),
  });
}

const MODELS = [
  defineModel({ id: "gpt-4o-mini",       providerName: "openai",    build: () => aiSdk("openai",    "gpt-4o-mini",       openai) }),
  defineModel({ id: "gpt-4.1",           providerName: "openai",    build: () => aiSdk("openai",    "gpt-4.1",           openai) }),
  defineModel({ id: "claude-sonnet-4-5", providerName: "anthropic", build: () => aiSdk("anthropic", "claude-sonnet-4-5", anthropic) }),
  defineModel({ id: "claude-haiku-4-5",  providerName: "anthropic", build: () => aiSdk("anthropic", "claude-haiku-4-5",  anthropic) }),
];

const DEFAULT_MODEL_ID = "gpt-4o-mini";

// Identity: change this string to give the CLI its own persona, name, voice, rules.
// Swap at runtime with `agent.setSystem("...")`.
const SYSTEM_PROMPT = [
  "You are a helpful CLI coding assistant running in the user's terminal.",
  "You have tools: bash (run shell), read_file, write_file, glob.",
  "Use tools when the task needs filesystem or shell access. Be concise.",
].join(" ");

// Initial theme. Built-ins: pink, ocean, matrix, amber, claude, mono.
// Type `/theme` while running to switch live, or define your own with
// `defineTheme({ accent: "#hex", ... })` from "@aflekkas/vibecli/themes".
const INITIAL_THEME: ThemeName = "pink";

async function runScenarioFromFile(scriptPath: string, provider: Provider): Promise<void> {
  const raw = await readFile(scriptPath, "utf8");
  const steps = JSON.parse(raw) as ScenarioStep[];
  const agent = createAgent(provider, SYSTEM_PROMPT, { tools: buildTools() });
  const r = await runScenario(agent, steps);
  process.exit(r.failed > 0 ? 1 : 0);
}

function Chat({
  themeName,
  onPickTheme,
}: {
  themeName: ThemeName;
  onPickTheme: (name: ThemeName) => void;
}) {
  const { exit } = useApp();
  const config = useVibeConfig();
  const muted = config.theme.colors.muted;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [input, setInput] = useState("");
  const [picking, setPicking] = useState<"theme" | "model" | null>(null);
  const [pendingImage, setPendingImage] = useState<{ mediaType: string; data: string } | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const toolsRef = useRef(buildTools());
  const historyRef = useRef(createCheckpointHistory<Message[]>([], { limit: 50 }));

  useEffect(() => {
    const initial = MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ?? MODELS[0]!;
    setAgent(createAgent(initial.build(), SYSTEM_PROMPT, { tools: toolsRef.current }));
  }, []);

  const { turns, setTurns, send: sendStream, busy, pushMeta, abort, reset } = useAgentStream(agent, {
    onBeforeSend: () => {
      if (agent) historyRef.current.checkpoint(agent.state.messages.slice(), "pre-turn");
    },
    onEvent: (ev) => {
      if (ev.type === "tool_start") {
        const preview = JSON.stringify(ev.input).slice(0, 80);
        pushMeta(`tool> ${ev.name} ${preview}`);
      } else if (ev.type === "tool_end") {
        const head = ev.output.split("\n").slice(0, 3).join("\n");
        const more = ev.output.length > head.length ? ` (+${ev.output.length - head.length} chars)` : "";
        pushMeta(`tool< ${ev.name}\n${head}${more}`);
      } else if (ev.type === "turn_done") {
        if (ev.usage) {
          const cache = ev.usage.cacheRead ? ` cache:${ev.usage.cacheRead}` : "";
          pushMeta(`tokens: in:${ev.usage.input} out:${ev.usage.output}${cache}`);
        }
      } else if (ev.type === "aborted") {
        pushMeta("aborted.");
      } else if (ev.type === "compacted") {
        pushMeta(`compacted: ${ev.messagesBefore} → ${ev.messagesAfter} messages`);
      }
    },
  });

  useInput((_input, key) => {
    if (key.escape && busy) abort();
  });

  async function send(text: string) {
    const blocks: ContentBlock[] = [{ type: "text", text }];
    if (pendingImage) {
      blocks.push({ type: "image", mediaType: pendingImage.mediaType, data: pendingImage.data });
      setPendingImage(null);
    }
    await sendStream(blocks);
  }

  const slash = useMemo(() => {
    const r = createSlashRegistry();
    r.add("model", () => setPicking("model"), "switch model (router across configured providers)");
    r.add("theme", () => setPicking("theme"), "switch theme");
    r.add("clip", async () => {
      const img = await readClipboardImage();
      if (!img) {
        pushMeta("no image on clipboard (or not macOS).");
        return;
      }
      setPendingImage(img);
      pushMeta(`clipboard image staged (${img.mediaType}, ${img.data.length} base64 chars). Send a message to attach.`);
    }, "attach clipboard image to next message (macOS)");
    r.add("undo", () => {
      if (!agent) return;
      if (!historyRef.current.canUndo) return pushMeta("nothing to undo.");
      const prev = historyRef.current.undo();
      if (prev) {
        agent.state.messages = prev.value.slice();
        setTurns((t) => t.filter((x) => x.role === "meta").concat({ role: "meta", text: "undone." }));
      }
    }, "revert last turn (uses checkpoint history)");
    r.add("redo", () => {
      if (!agent) return;
      if (!historyRef.current.canRedo) return pushMeta("nothing to redo.");
      const next = historyRef.current.redo();
      if (next) {
        agent.state.messages = next.value.slice();
        pushMeta("redone.");
      }
    }, "re-apply an undone turn");
    r.add("tools", () => {
      pushMeta("tools:\n" + toolsRef.current.map((t) => `  ${t.def.name}  ${t.def.description}`).join("\n"));
    }, "list available tools");
    r.add("clear", () => {
      const current = MODELS.find((m) => m.id === modelId) ?? MODELS[0]!;
      setAgent(createAgent(current.build(), SYSTEM_PROMPT, { tools: toolsRef.current }));
      historyRef.current.clear([]);
      reset();
      setPendingImage(null);
      pushMeta("conversation reset.");
    }, "reset conversation");
    r.add("help", () => {
      pushMeta(r.help() + "\n(esc cancels in-flight generation; empty submit exits)");
    }, "show commands");
    return r;
  }, [agent, modelId, pushMeta, reset, setTurns]);

  return (
    <Box flexDirection="column" gap={1}>
      <GradientText text="vibecli" />
      <Text color={muted}>
        model: {modelId}. Type `/help` for commands. Submit empty to exit.
      </Text>
      <MessageList turns={turns} prefix={{ user: "you> ", assistant: "ai> ", meta: "meta> " }} />
      {pendingImage ? (
        <Text color={muted} dimColor>
          [image attached, send a message to deliver]
        </Text>
      ) : null}
      {picking === "theme" ? (
        <ThemePicker
          value={themeName}
          onPick={(name) => {
            onPickTheme(name);
            setPicking(null);
          }}
          onCancel={() => setPicking(null)}
        />
      ) : picking === "model" ? (
        <ModelPicker
          models={MODELS}
          value={modelId}
          onPick={(id) => {
            const next = MODELS.find((m) => m.id === id);
            if (next && agent) {
              agent.setProvider(next.build());
              setModelId(id);
              pushMeta(`model: ${id} (${next.providerName})`);
            }
            setPicking(null);
          }}
          onCancel={() => setPicking(null)}
        />
      ) : (
        <TextInput
          value={input}
          onChange={setInput}
          placeholder={busy ? "thinking..." : "ask anything (try /help)"}
          tabText="  "
          onSubmit={async (text) => {
            const trimmed = text.trim();
            if (!trimmed) {
              exit();
              return;
            }
            setInput("");
            const result = await slash.dispatch(trimmed);
            if (result === "unknown") {
              pushMeta(`unknown command: ${trimmed}. Try /help.`);
              return;
            }
            if (result === "not-slash") {
              void send(trimmed);
            }
          }}
        />
      )}
    </Box>
  );
}

function App() {
  const [themeName, setThemeName] = useState<ThemeName>(INITIAL_THEME);
  return (
    <VibeConfigProvider config={themes[themeName]}>
      <Chat themeName={themeName} onPickTheme={setThemeName} />
    </VibeConfigProvider>
  );
}

const argv = process.argv.slice(2);
const scriptIdx = argv.indexOf("--script");
if (scriptIdx >= 0) {
  const scriptPath = argv[scriptIdx + 1];
  if (!scriptPath) {
    process.stderr.write("--script requires a path\n");
    process.exit(2);
  }
  const initial = MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ?? MODELS[0]!;
  await runScenarioFromFile(scriptPath, initial.build());
} else {
  render(<App />);
}
