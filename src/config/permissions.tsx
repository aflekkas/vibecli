import React from "react";
import { Box, Text, useInput } from "ink";
import { useVibeConfig } from "../ui/ui-config.tsx";

export type PermissionMode = "default" | "plan" | "acceptEdits" | "auto" | "bypass";

export type PermissionDecision = "allow" | "ask" | "deny";

export type PermissionRules = {
  /** Glob patterns matching `tool[:input-key]`. */
  allow?: ReadonlyArray<string>;
  /** Glob patterns. Forces a prompt regardless of mode. */
  ask?: ReadonlyArray<string>;
  /** Glob patterns matching `tool[:input-key]`. Beats allow and ask. */
  deny?: ReadonlyArray<string>;
};

export type EvaluatePermissionInput = {
  tool: string;
  /** Optional caller-derived sub-key, e.g. a command string for a bash tool, a path for a write tool. */
  inputKey?: string;
  rules: PermissionRules;
  mode: PermissionMode;
};

export type EvaluatePermissionResult = {
  decision: PermissionDecision;
  /** Why we landed on this decision — for logging or to render in the prompt. */
  reason: string;
};

// Escape regex specials except `*`, which we expand into `.*` / `[^:]*` ourselves.
const REGEX_SPECIALS = /[.+?^${}()|[\]\\]/g;

function escapeLiteral(segment: string): string {
  return segment.replace(REGEX_SPECIALS, "\\$&");
}

function compilePattern(pattern: string): RegExp {
  // Walk the pattern, treating `**` as `.*`, `*` as `[^:]*`, everything else literal.
  let out = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 2;
      } else {
        out += "[^:]*";
        i += 1;
      }
    } else {
      out += escapeLiteral(ch!);
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

/** Glob matcher exposed for callers that want to test their own patterns. */
export function matchPermissionPattern(pattern: string, target: string): boolean {
  return compilePattern(pattern).test(target);
}

function targetFor(tool: string, inputKey: string | undefined): string {
  return inputKey ? `${tool}:${inputKey}` : tool;
}

function findMatch(patterns: ReadonlyArray<string> | undefined, target: string): string | undefined {
  if (!patterns) return undefined;
  for (const p of patterns) {
    if (matchPermissionPattern(p, target)) return p;
  }
  return undefined;
}

export function evaluatePermission(input: EvaluatePermissionInput): EvaluatePermissionResult {
  const { tool, inputKey, rules, mode } = input;

  if (mode === "bypass") {
    return { decision: "allow", reason: "bypass mode" };
  }

  const target = targetFor(tool, inputKey);

  const denied = findMatch(rules.deny, target);
  if (denied) return { decision: "deny", reason: `denied by rule: ${denied}` };

  const asked = findMatch(rules.ask, target);
  if (asked) return { decision: "ask", reason: `ask required by rule: ${asked}` };

  const allowed = findMatch(rules.allow, target);
  if (allowed) return { decision: "allow", reason: `allowed by rule: ${allowed}` };

  switch (mode) {
    case "plan":
      return { decision: "deny", reason: "plan mode: tool execution disabled" };
    case "acceptEdits":
      return { decision: "allow", reason: "acceptEdits mode" };
    case "auto":
      return { decision: "allow", reason: "auto mode" };
    case "default":
      return { decision: "ask", reason: "no rule matched, default mode asks" };
  }
}

export type PermissionPromptProps = {
  tool: string;
  inputKey?: string;
  /** Reason from evaluatePermission, surfaced in the modal. */
  reason?: string;
  /** Render an additional details block when expanded. */
  details?: string;
  /** Default: false. Toggled by Ctrl+E (the consumer wires the keybinding via useInput). */
  showDetails?: boolean;
  onAllow: () => void;
  onAllowSession?: () => void;
  onDeny: () => void;
  /** Optional callback for the consumer to toggle showDetails. */
  onExplain?: () => void;
};

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  tool,
  inputKey,
  reason,
  details,
  showDetails = false,
  onAllow,
  onAllowSession,
  onDeny,
  onExplain,
}) => {
  const { theme } = useVibeConfig();
  const accent = theme.colors.accent;
  const muted = theme.colors.muted;
  const danger = theme.colors.error;
  const success = theme.colors.success;

  useInput((ch) => {
    const key = ch.toLowerCase();
    if (key === "a") onAllow();
    else if (key === "s" && onAllowSession) onAllowSession();
    else if (key === "d") onDeny();
    else if (key === "e" && onExplain) onExplain();
  });

  const sessionHint = onAllowSession ? "[s] allow for session   " : "";

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={accent} paddingX={1}>
      <Text bold color={accent}>
        permission required
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color={muted}>tool: </Text>
          <Text>{tool}</Text>
        </Text>
        {inputKey ? (
          <Text>
            <Text color={muted}>target: </Text>
            <Text>{`${tool}:${inputKey}`}</Text>
          </Text>
        ) : null}
        {reason ? (
          <Text color={muted}>{reason}</Text>
        ) : null}
      </Box>
      {showDetails && details ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{details}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text>
          <Text color={success}>[a] allow once</Text>
          <Text color={muted}>   {sessionHint}</Text>
          <Text color={danger}>[d] deny</Text>
          <Text color={muted}>   [e] explain</Text>
        </Text>
      </Box>
    </Box>
  );
};
