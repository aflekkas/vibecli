import { describe, expect, test } from "bun:test";
import { evaluatePermission, matchPermissionPattern } from "./permissions.tsx";

describe("evaluatePermission", () => {
  test("deny rule beats allow rule", () => {
    const result = evaluatePermission({
      tool: "bash",
      inputKey: "rm -rf /",
      rules: { allow: ["bash:*"], deny: ["bash:rm *"] },
    });
    expect(result.decision).toBe("deny");
    expect(result.reason).toContain("bash:rm *");
  });

  test("ask rule beats allow rule", () => {
    const result = evaluatePermission({
      tool: "write_file",
      inputKey: "/etc/passwd",
      rules: { allow: ["write_file:**"], ask: ["write_file:/etc/*"] },
    });
    expect(result.decision).toBe("ask");
    expect(result.reason).toContain("write_file:/etc/*");
  });

  test("allow rule wins when no deny / ask matches", () => {
    const result = evaluatePermission({
      tool: "read_file",
      inputKey: "/tmp/foo",
      rules: { allow: ["read_file:/tmp/*"], deny: ["read_file:/etc/*"] },
    });
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("read_file:/tmp/*");
  });

  test("no rule matched returns ask", () => {
    const result = evaluatePermission({
      tool: "anything",
      rules: {},
    });
    expect(result.decision).toBe("ask");
    expect(result.reason).toBe("no rule matched");
  });

  test("target without inputKey is just the tool name", () => {
    const result = evaluatePermission({
      tool: "bash",
      rules: { allow: ["bash"] },
    });
    expect(result.decision).toBe("allow");
  });
});

describe("matchPermissionPattern", () => {
  test("`*` excludes `:`", () => {
    expect(matchPermissionPattern("bash:*", "bash:rm -rf")).toBe(true);
    expect(matchPermissionPattern("bash:*", "bash:foo:bar")).toBe(false);
  });

  test("`**` includes `:`", () => {
    expect(matchPermissionPattern("bash:**", "bash:foo:bar")).toBe(true);
    expect(matchPermissionPattern("**", "anything:goes:here")).toBe(true);
  });

  test("literal segments match exactly", () => {
    expect(matchPermissionPattern("bash", "bash")).toBe(true);
    expect(matchPermissionPattern("bash", "bash:rm")).toBe(false);
    expect(matchPermissionPattern("read_file:/etc/passwd", "read_file:/etc/passwd")).toBe(true);
    expect(matchPermissionPattern("read_file:/etc/passwd", "read_file:/etc/shadow")).toBe(false);
  });

  test("`*` is greedy within a non-`:` segment", () => {
    expect(matchPermissionPattern("*:rm *", "bash:rm -rf")).toBe(true);
    expect(matchPermissionPattern("read_file:/etc/*", "read_file:/etc/passwd")).toBe(true);
    // a `:` in the input key still blocks `*` from matching it
    expect(matchPermissionPattern("read_file:/etc/*", "read_file:/etc/foo:bar")).toBe(false);
  });

  test("regex-special characters in patterns are escaped", () => {
    expect(matchPermissionPattern("write_file:/a.b/c", "write_file:/a.b/c")).toBe(true);
    // The `.` should not act as a regex wildcard.
    expect(matchPermissionPattern("write_file:/a.b/c", "write_file:/aXb/c")).toBe(false);
    expect(matchPermissionPattern("tool(1)", "tool(1)")).toBe(true);
    expect(matchPermissionPattern("tool[a]+b$", "tool[a]+b$")).toBe(true);
  });

  test("`**` plus literal suffix", () => {
    expect(matchPermissionPattern("**:dangerous", "bash:nested:dangerous")).toBe(true);
    expect(matchPermissionPattern("**:dangerous", "bash:safe")).toBe(false);
  });
});
