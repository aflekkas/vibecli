export { TextInput } from "./text-input.tsx";
export type {
  TextInputKeyBinding,
  TextInputOptions,
  TextInputProps,
  TextInputShortcut,
  TextInputSpecialKey,
} from "./text-input.tsx";
export {
  mediaTypeForPath,
  readImageFile,
  readClipboardImage,
  extractImagePaths,
  writeTempImage,
} from "./clipboard.ts";
export type { TempImageOptions } from "./clipboard.ts";
export { defaultHighlightTheme, highlight } from "./highlight.ts";
export type { HighlightOptions, HighlightTheme } from "./highlight.ts";
export {
  createVibeConfig,
  defaultVibeConfig,
  formatLoadingStatus,
  loadingFrameAt,
  loadingLabelAt,
  mergeTextInputOptions,
  useVibeConfig,
  VibeConfigProvider,
} from "./ui-config.tsx";
export type {
  LoadingConfig,
  MessageConfig,
  MessageRole,
  MessageStyle,
  TextInputConfig,
  VibeConfig,
  VibeConfigInput,
  VibeConfigProviderProps,
} from "./ui-config.tsx";
export {
  createTheme,
  defaultTheme,
  gradientColorAt,
  rgbToHex,
  hslToRgb,
  rainbowColorAt,
  pinkGradientAt,
  wrapText,
  GradientText,
} from "./ui.tsx";
export type { GradientConfig, GradientTextProps, VibeTheme, VibeThemeInput } from "./ui.tsx";
export { withRetry } from "./retry.ts";
export type { RetryOpts } from "./retry.ts";
export { createProjectSkeleton } from "./create-project.ts";
export type {
  CreatedFile,
  CreateProjectOptions,
  CreateProjectResult,
  PackageManager,
} from "./create-project.ts";
export { CheckpointHistory, createCheckpointHistory } from "./checkpoints.ts";
export type { Checkpoint, CheckpointHistoryOptions } from "./checkpoints.ts";
export {
  pathToUri,
  uriToPath,
  createLineIndex,
  positionAt,
  offsetAt,
  rangeAt,
  textInRange,
} from "./lsp.ts";
export type { LspPosition, LspRange, LspLocation } from "./lsp.ts";
export {
  mcpToolToToolDef,
  mcpToolsToToolDefs,
  toolDefToMcpTool,
  mcpResultToText,
} from "./mcp.ts";
export type {
  JsonObjectSchema,
  McpTool,
  McpTextContent,
  McpImageContent,
  McpAudioContent,
  McpEmbeddedResource,
  McpContent,
  McpToolResult,
} from "./mcp.ts";
export {
  buildRepoMap,
  languageForPath,
  classifyRepoFile,
  summarizeRepoMap,
} from "./repo-map.ts";
export type { RepoFileKind, RepoMapFile, RepoMap, RepoMapOptions } from "./repo-map.ts";
export {
  firstStatusLine,
  runStatusLineCommand,
  truncateStatusLine,
} from "./status-line.ts";
export type { StatusLineCommandOptions, StatusLinePayload } from "./status-line.ts";
export { Picker } from "./picker.tsx";
export type { PickerItem, PickerProps } from "./picker.tsx";
export type {
  Role,
  ToolCall,
  ContentBlock,
  Message,
  ToolDef,
  StreamEvent,
  Provider,
} from "./providers/types.ts";
export { AiSdkProvider } from "./providers/adapter.ts";
export type { AdapterJsonValue, AdapterOpts, AdapterProviderOptions } from "./providers/adapter.ts";
export { defineTheme, themes, themeNames, isThemeName } from "./themes.ts";
export type { DefineThemeInput, ThemeName } from "./themes.ts";
export { ThemePicker } from "./theme-picker.tsx";
export type { ThemePickerProps } from "./theme-picker.tsx";
export { parseFrontmatter, parseBool, deriveDescription } from "./frontmatter.ts";
export type { Frontmatter } from "./frontmatter.ts";
export { loadMarkdownDir } from "./markdown-dir.ts";
export type {
  LoadDirEntry,
  LoadEntryContext,
  LoadMarkdownDirOptions,
} from "./markdown-dir.ts";
export { DEFAULT_RESERVED, extendReserved } from "./commands/reserved.ts";
export { createAgent } from "./agent.ts";
export type {
  Agent,
  AgentEvent,
  AgentOptions,
  AgentState,
  LifecycleContext,
  LifecycleEvent,
  ToolEntry,
  ToolHandler,
  TurnUsage,
} from "./agent.ts";
export { runScenario } from "./scenarios.ts";
export type {
  RunScenarioOptions,
  ScenarioFailure,
  ScenarioResult,
  ScenarioStep,
} from "./scenarios.ts";
export { MessageList, useAgentStream } from "./chat.tsx";
export type {
  MessageListProps,
  Turn,
  UseAgentStreamOptions,
  UseAgentStreamResult,
} from "./chat.tsx";
