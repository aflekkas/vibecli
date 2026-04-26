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
import type { ContentBlock, Provider } from "@aflekkas/vibecli/providers";
import { readFile } from "node:fs/promises";

// Model registry. Add an entry to expose a new model in `/model`.
// Each entry needs: a stable id (the picker key), the provider name vibecli passes
// to the AI SDK adapter, and a thunk that builds the languageModel on demand.
// To add Google: `bun add @ai-sdk/google`, import `google`, push another entry.
type ModelEntry = {
  id: string;
  providerName: string;
  build: () => Provider;
};

function aiSdk(providerName: string, modelId: string, factory: (id: string) => any): Provider {
  return new AiSdkProvider({
    name: providerName,
    model: modelId,
    languageModel: factory(modelId),
  });
}

const MODELS: ModelEntry[] = [
  { id: "gpt-4o-mini",       providerName: "openai",    build: () => aiSdk("openai",    "gpt-4o-mini",       openai) },
  { id: "gpt-4.1",           providerName: "openai",    build: () => aiSdk("openai",    "gpt-4.1",           openai) },
  { id: "claude-sonnet-4-5", providerName: "anthropic", build: () => aiSdk("anthropic", "claude-sonnet-4-5", anthropic) },
  { id: "claude-haiku-4-5",  providerName: "anthropic", build: () => aiSdk("anthropic", "claude-haiku-4-5",  anthropic) },
];

const DEFAULT_MODEL_ID = "gpt-4o-mini";

// Identity: change this string to give the CLI its own persona, name, voice, rules.
// Swap at runtime with `agent.setSystem("...")`.
const SYSTEM_PROMPT = "You are a helpful CLI assistant. Be concise.";

// Initial theme. Built-ins: pink, ocean, matrix, amber, claude, mono.
// Type `/theme` while running to switch live, or define your own with
// `defineTheme({ accent: "#hex", ... })` from "@aflekkas/vibecli/themes".
const INITIAL_THEME: ThemeName = "pink";

type Turn = { role: "user" | "assistant" | "meta"; text: string };

async function runScenarioFromFile(scriptPath: string, provider: Provider): Promise<void> {
  const raw = await readFile(scriptPath, "utf8");
  const steps = JSON.parse(raw) as ScenarioStep[];
  const agent = createAgent(provider, SYSTEM_PROMPT);
  const r = await runScenario(agent, steps);
  process.exit(r.failed > 0 ? 1 : 0);
}

const HELP_TEXT = [
  "/model   switch model (router across configured providers)",
  "/theme   switch theme",
  "/clip    attach clipboard image to next message (macOS)",
  "/clear   reset conversation",
  "/help    show commands",
  "(empty submit exits)",
].join("\n");

function ModelPicker({
  value,
  onPick,
  onCancel,
}: {
  value: string;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const config = useVibeConfig();
  const accent = config.theme.colors.accent;
  const muted = config.theme.colors.muted;
  const initial = useMemo(() => Math.max(0, MODELS.findIndex((m) => m.id === value)), [value]);
  const [index, setIndex] = useState(initial);

  useInput((_input, key) => {
    if (key.upArrow) setIndex((i) => (i - 1 + MODELS.length) % MODELS.length);
    else if (key.downArrow) setIndex((i) => (i + 1) % MODELS.length);
    else if (key.return) onPick(MODELS[index]!.id);
    else if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column">
      {MODELS.map((m, i) => {
        const selected = i === index;
        return (
          <Box key={m.id}>
            <Text color={accent}>{selected ? "› " : "  "}</Text>
            <Text color={accent} bold={selected}>
              {m.id.padEnd(20)}
            </Text>
            <Text color={muted}>{m.providerName}</Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color={muted}>↑/↓ choose, enter pick, esc cancel</Text>
      </Box>
    </Box>
  );
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
  const accent = config.theme.colors.accent;
  const muted = config.theme.colors.muted;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<"theme" | "model" | null>(null);
  const [pendingImage, setPendingImage] = useState<{ mediaType: string; data: string } | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const agentRef = useRef<Agent | null>(null);

  useEffect(() => {
    const initial = MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ?? MODELS[0]!;
    agentRef.current = createAgent(initial.build(), SYSTEM_PROMPT);
  }, []);

  function pushMeta(text: string) {
    setTurns((t) => [...t, { role: "meta", text }]);
  }

  async function send(text: string) {
    const agent = agentRef.current;
    if (!agent) return;
    const blocks: ContentBlock[] = [{ type: "text", text }];
    if (pendingImage) {
      blocks.push({ type: "image", mediaType: pendingImage.mediaType, data: pendingImage.data });
      setPendingImage(null);
    }
    setTurns((t) => [...t, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    try {
      for await (const ev of agent.send(blocks)) {
        if (ev.type === "text") {
          setTurns((t) => {
            const next = t.slice();
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { role: "assistant", text: last.text + ev.text };
            }
            return next;
          });
        } else if (ev.type === "error") {
          setTurns((t) => [...t, { role: "assistant", text: `error: ${ev.message}` }]);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSlash(cmd: string) {
    if (cmd === "/theme") {
      setPicking("theme");
      return;
    }
    if (cmd === "/model") {
      setPicking("model");
      return;
    }
    if (cmd === "/help") {
      pushMeta(HELP_TEXT);
      return;
    }
    if (cmd === "/clear") {
      const current = MODELS.find((m) => m.id === modelId) ?? MODELS[0]!;
      agentRef.current = createAgent(current.build(), SYSTEM_PROMPT);
      setTurns([]);
      setPendingImage(null);
      pushMeta("conversation reset.");
      return;
    }
    if (cmd === "/clip") {
      const img = await readClipboardImage();
      if (!img) {
        pushMeta("no image on clipboard (or not macOS).");
        return;
      }
      setPendingImage(img);
      pushMeta(`clipboard image staged (${img.mediaType}, ${img.data.length} base64 chars). Send a message to attach.`);
      return;
    }
    pushMeta(`unknown command: ${cmd}. Try /help.`);
  }

  return (
    <Box flexDirection="column" gap={1}>
      <GradientText text="vibecli" />
      <Text color={muted}>
        model: {modelId}. Type `/help` for commands. Submit empty to exit.
      </Text>
      {turns.map((t, i) => (
        <Box key={i} flexDirection="column">
          <Text color={t.role === "user" ? accent : t.role === "meta" ? muted : undefined} dimColor={t.role === "meta"}>
            {(t.role === "user" ? "you" : t.role === "meta" ? "meta" : "ai") + "> " + t.text}
          </Text>
        </Box>
      ))}
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
          value={modelId}
          onPick={(id) => {
            const next = MODELS.find((m) => m.id === id);
            if (next && agentRef.current) {
              agentRef.current.setProvider(next.build());
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
          onSubmit={(text) => {
            const trimmed = text.trim();
            if (!trimmed) {
              exit();
              return;
            }
            if (trimmed.startsWith("/")) {
              setInput("");
              void handleSlash(trimmed);
              return;
            }
            setInput("");
            void send(trimmed);
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
