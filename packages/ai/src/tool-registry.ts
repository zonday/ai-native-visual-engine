import { SemanticActionSchema } from "@ai-native/core";
import { z as zodImpl } from "zod/v4";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolRegistry {
  getDefinitions(): ToolDefinition[];
  getActionType(toolName: string): string | undefined;
}

const TOOL_MAP: Record<string, { description: string }> = {
  "create-dashboard": {
    description:
      "Create a new dashboard page with specified title, layout strategy, and widgets. Use when user asks to build a dashboard or add visual components.",
  },
  "insert-chart": {
    description:
      "Insert a chart component into an existing container. Specify chart type, data source, dimensions, and metrics.",
  },
  "auto-layout": {
    description:
      "Automatically arrange child elements within a page using a layout strategy (compact, balanced, or presentation).",
  },
  "update-theme-intent": {
    description:
      "Update the theme for a document or specific page. Specify themeId for document-level or pageId for page-level changes.",
  },
};

export function createToolRegistry(): ToolRegistry {
  const definitions: ToolDefinition[] = [];
  const actionTypeMap = new Map<string, string>();

  const toolSchemas = SemanticActionSchema.options as zodImpl.ZodType[];
  for (const schema of toolSchemas) {
    const parsed = schema.safeParse({ type: "" });
    if (!parsed.success) {
      const shape = (
        schema as zodImpl.ZodObject<Record<string, zodImpl.ZodType>>
      ).shape;
      if (shape && "type" in shape) {
        const typeSchema = shape.type as zodImpl.ZodLiteral<string>;
        const typeValue = typeSchema.value;
        const toolName = typeValue;
        const jsonSchema = zodToJsonSchema(schema, typeValue);
        const meta = TOOL_MAP[toolName] ?? {
          description: `${toolName} action`,
        };

        definitions.push({
          type: "function" as const,
          function: {
            name: toolName,
            description: meta.description,
            parameters: jsonSchema,
          },
        });
        actionTypeMap.set(toolName, typeValue);
      }
    }
  }

  return {
    getDefinitions(): ToolDefinition[] {
      return definitions;
    },
    getActionType(toolName: string): string | undefined {
      return actionTypeMap.get(toolName);
    },
  };
}

function zodToJsonSchema(
  schema: zodImpl.ZodType,
  _typeName: string,
): Record<string, unknown> {
  const shape: Record<string, unknown> = {
    type: "object",
    properties: {},
    required: [],
  };

  if (schema instanceof zodImpl.ZodObject) {
    const schemaShape = (
      schema as zodImpl.ZodObject<Record<string, zodImpl.ZodType>>
    ).shape;
    for (const [key, valueSchema] of Object.entries(schemaShape)) {
      if (key === "type") continue;
      const def = zodFieldToJsonSchema(valueSchema);
      (shape.properties as Record<string, unknown>)[key] = def;

      const isRequired = !(valueSchema instanceof zodImpl.ZodOptional);
      if (isRequired) {
        (shape.required as string[]).push(key);
      }
    }
  }

  return shape;
}

function zodFieldToJsonSchema(
  schema: zodImpl.ZodType,
): Record<string, unknown> {
  if (schema instanceof zodImpl.ZodOptional) {
    return zodFieldToJsonSchema(
      (schema as zodImpl.ZodOptional<zodImpl.ZodType>).unwrap(),
    );
  }
  if (schema instanceof zodImpl.ZodString) {
    return { type: "string" };
  }
  if (schema instanceof zodImpl.ZodNumber) {
    return { type: "number" };
  }
  if (schema instanceof zodImpl.ZodEnum) {
    const values = (schema as unknown as { options?: string[] }).options ?? [];
    return { type: "string", enum: values };
  }
  if (schema instanceof zodImpl.ZodArray) {
    const itemSchema = (schema as zodImpl.ZodArray<zodImpl.ZodType>).element;
    return { type: "array", items: zodFieldToJsonSchema(itemSchema) };
  }
  return { type: "string" };
}
