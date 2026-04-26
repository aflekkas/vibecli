import React, { useEffect, useRef, useState } from "react";
import { Box, Text, render, useApp } from "ink";
import { anthropic } from "@ai-sdk/anthropic";
import { TextInput } from "@aflekkas/vibecli/text-input";
import { GradientText } from "@aflekkas/vibecli/ui";
import { VibeConfigProvider, useVibeConfig } from "@aflekkas/vibecli/config";
import { themes, type ThemeName } from "@aflekkas/vibecli/themes";
import { ThemePicker } from "@aflekkas/vibecli/theme-picker";
import { AiSdkProvider } from "@aflekkas/vibecli/providers/adapter";
import { createAgent, type Agent } from "@aflekkas/vibecli/agent";
import { readClipboardImage } from "@aflekkas/vibecli/clipboard";
import type { ContentBlock } from "@aflekkas/vibecli/providers";
import { readFile } from "node:fs/promises";

const MODEL = "claude-sonnet-4-5";
const provider = new AiSdkProvider({
  name: "anthropic",
  model: MODEL,
  languageModel: anthropic(MODEL),
});

const SYSTEM_PROMPT = "You are a helpful CLI assistant. Be concise.";
const INITIAL_THEME: ThemeName = "pink";

type Turn = { role: "user" | "assistant" | "meta"; text: string };

const HELP_TEXT = [
  "/theme   switch theme",
  "/clip    attach clipboard image to next message (macOS)",
  "/clear   reset conversation",
  "/help    show commands",
  "(empty submit exits)",
].join("\n");

type ScenarioStep = { input: string; expectContains?: string };

async function runScenario(scriptPath: string): Promise<void> {
  const raw = await readFile(scriptPath, "utf8");
  const steps = JSON.parse(raw) as ScenarioStep[];
  const agent = createAgent(provider, SYSTEM_PROMPT);
  let failed = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    process.stdout.write(`[${i + 1}/${steps.length}] you> ${step.input}\n`);
    let assistantText = "";
    for await (const ev of agent.send(step.input)) {
      if (ev.type === "text") {
        assistantText += ev.text;
        process.stdout.write(ev.text);
      } else if (ev.type === "error") {
        process.stdout.write(`\n[error] ${ev.message}\n`);
        failed++;
      }
    }
    process.stdout.write("\n");
    if (step.expectContains) {
      const ok = assistantText.toLowerCase().includes(step.expectContains.toLowerCase());
      process.stdout.write(
        ok
          ? `[pass] expectContains: ${step.expectContains}\n`
          : `[fail] expectContains: ${step.expectContains} (got: ${assistantText.slice(0, 120)}...)\n`,
      );
      if (!ok) failed++;
    }
  }
  if (failed > 0) {
    process.stdout.write(`\nscenario failed: ${failed} issue(s)\n`);
    process.exit(1);
  }
  process.stdout.write(`\nscenario passed: ${steps.length} step(s)\n`);
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
  const [picking, setPicking] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ mediaType: string; data: string } | null>(null);
  const agentRef = useRef<Agent | null>(null);

  useEffect(() => {
    agentRef.current = createAgent(provider, SYSTEM_PROMPT);
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
      setPicking(true);
      return;
    }
    if (cmd === "/help") {
      pushMeta(HELP_TEXT);
      return;
    }
    if (cmd === "/clear") {
      agentRef.current = createAgent(provider, SYSTEM_PROMPT);
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
      <GradientText text="vibecli examples playground" />
      <Text color={muted}>
        Local source via tsconfig paths. Edits in ../../src/ show up on next run. Type /help for commands.
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
      {picking ? (
        <ThemePicker
          value={themeName}
          onPick={(name) => {
            onPickTheme(name);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
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
  await runScenario(scriptPath);
} else {
  render(<App />);
}
