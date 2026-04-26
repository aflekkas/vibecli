export { TextInput } from "./ui/text-input.tsx";
export type {
  TextInputKeyBinding,
  TextInputOptions,
  TextInputProps,
  TextInputShortcut,
  TextInputSpecialKey,
} from "./ui/text-input.tsx";
export {
  mediaTypeForPath,
  readImageFile,
  readClipboardImage,
  extractImagePaths,
  writeTempImage,
} from "./clipboard.ts";
export type { TempImageOptions } from "./clipboard.ts";
export { defaultHighlightTheme, highlight } from "./ui/highlight.ts";
export type { HighlightOptions, HighlightTheme } from "./ui/highlight.ts";
export {
  createVibeConfig,
  defaultVibeConfig,
  formatLoadingStatus,
  loadingFrameAt,
  loadingLabelAt,
  mergeTextInputOptions,
  useVibeConfig,
  VibeConfigProvider,
} from "./ui/ui-config.tsx";
export type {
  LoadingConfig,
  MessageConfig,
  MessageRole,
  MessageStyle,
  TextInputConfig,
  VibeConfig,
  VibeConfigInput,
  VibeConfigProviderProps,
} from "./ui/ui-config.tsx";
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
} from "./ui/ui.tsx";
export type { GradientConfig, GradientTextProps, VibeTheme, VibeThemeInput } from "./ui/ui.tsx";
export { withRetry } from "./agent/retry.ts";
export type { RetryOpts } from "./agent/retry.ts";
export { createProjectSkeleton } from "./create-project.ts";
export type {
  CreatedFile,
  CreateProjectOptions,
  CreateProjectResult,
  PackageManager,
} from "./create-project.ts";
export { CheckpointHistory, createCheckpointHistory } from "./agent/checkpoints.ts";
export type { Checkpoint, CheckpointHistoryOptions } from "./agent/checkpoints.ts";
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
export { Picker } from "./ui/picker.tsx";
export type { PickerItem, PickerProps } from "./ui/picker.tsx";
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
export { defineTheme, themes, themeNames, isThemeName } from "./ui/themes.ts";
export type { DefineThemeInput, ThemeName } from "./ui/themes.ts";
export { ThemePicker } from "./ui/theme-picker.tsx";
export type { ThemePickerProps } from "./ui/theme-picker.tsx";
export { parseFrontmatter, parseBool, deriveDescription } from "./frontmatter.ts";
export type { Frontmatter } from "./frontmatter.ts";
export { loadMarkdownDir } from "./markdown-dir.ts";
export type {
  LoadDirEntry,
  LoadEntryContext,
  LoadMarkdownDirOptions,
} from "./markdown-dir.ts";
export { DEFAULT_RESERVED, extendReserved } from "./commands/reserved.ts";
export { createSlashRegistry } from "./commands/slash.ts";
export type { SlashEntry, SlashHandler, SlashRegistry } from "./commands/slash.ts";
export { createAgent } from "./agent/agent.ts";
export type {
  Agent,
  AgentEvent,
  AgentOptions,
  AgentState,
  LifecycleContext,
  LifecycleEvent,
  LifecycleResult,
  ToolEntry,
  ToolHandler,
  TurnUsage,
} from "./agent/agent.ts";
export { runScenario, runScenarioFile } from "./agent/scenarios.ts";
export type {
  RunScenarioOptions,
  ScenarioFailure,
  ScenarioResult,
  ScenarioStep,
} from "./agent/scenarios.ts";
export { defineModel, ModelPicker } from "./ui/models.tsx";
export type { ModelEntry, ModelPickerProps } from "./ui/models.tsx";
export { MessageList, useAgentStream } from "./ui/chat.tsx";
export type {
  MessageListProps,
  Turn,
  UseAgentStreamOptions,
  UseAgentStreamResult,
} from "./ui/chat.tsx";
export {
  loadSettingsHierarchy,
  mergeSettings,
} from "./config/settings.ts";
export type {
  ArrayPolicy,
  LoadSettingsHierarchyOptions,
  MergeSettingsOptions,
  SettingsLoadResult,
  SettingsSource,
} from "./config/settings.ts";
export {
  evaluatePermission,
  matchPermissionPattern,
  PermissionPrompt,
} from "./config/permissions.tsx";
export type {
  EvaluatePermissionInput,
  EvaluatePermissionResult,
  PermissionDecision,
  PermissionMode,
  PermissionPromptProps,
  PermissionRules,
} from "./config/permissions.tsx";
