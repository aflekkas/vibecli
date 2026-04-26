import type { ToolDef } from "../providers/types.ts";

export type JsonObjectSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: JsonObjectSchema;
};

export type McpTextContent = {
  type: "text";
  text: string;
};

export type McpImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type McpAudioContent = {
  type: "audio";
  data: string;
  mimeType: string;
};

export type McpEmbeddedResource = {
  type: "resource";
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
    [key: string]: unknown;
  };
};

export type McpContent = McpTextContent | McpImageContent | McpAudioContent | McpEmbeddedResource;

export type McpToolResult = {
  content: McpContent[];
  isError?: boolean;
};

/**
 * Converts an MCP tool descriptor to the generic `ToolDef` shape.
 * Preserves `required` only when the input schema includes it.
 */
export function mcpToolToToolDef(tool: McpTool): ToolDef {
  return {
    name: tool.name,
    description: tool.description ?? "",
    input_schema: {
      type: "object",
      properties: tool.inputSchema?.properties ?? {},
      ...(tool.inputSchema?.required ? { required: tool.inputSchema.required } : {}),
    },
  };
}

export function mcpToolsToToolDefs(tools: McpTool[]): ToolDef[] {
  return tools.map(mcpToolToToolDef);
}

/** Inverse of `mcpToolToToolDef`. Preserves `required` only when present. */
export function toolDefToMcpTool(tool: ToolDef): McpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties: tool.input_schema.properties,
      ...(tool.input_schema.required ? { required: tool.input_schema.required } : {}),
    },
  };
}

/**
 * Lossy collapse of an MCP tool result to a plain string.
 * Image and audio blocks become `[image: …]` / `[audio: …]` placeholders.
 * Embedded resources prefer their `text` field; fall back to the URI.
 */
export function mcpResultToText(result: McpToolResult): string {
  return result.content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "image") return `[image: ${block.mimeType}]`;
      if (block.type === "audio") return `[audio: ${block.mimeType}]`;
      if (block.resource.text != null) return block.resource.text;
      return `[resource: ${block.resource.uri}]`;
    })
    .join("\n");
}
