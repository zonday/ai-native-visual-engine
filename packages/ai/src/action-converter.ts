import {
  type CompileResult,
  compileSemanticAction,
  type SemanticAction,
} from "@ai-native/core";
import type { ToolRegistry } from "./tool-registry.js";

export interface ModelToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ConvertResult {
  ok: boolean;
  action?: SemanticAction;
  compileResult?: CompileResult;
  diagnostics: string[];
}

export function convertModelResponse(
  toolCall: ModelToolCall,
  registry: ToolRegistry,
): ConvertResult {
  const diagnostics: string[] = [];
  const toolName = toolCall.function.name;
  const actionType = registry.getActionType(toolName);

  if (!actionType) {
    diagnostics.push(`Unknown tool: "${toolName}"`);
    return { ok: false, diagnostics };
  }

  let rawArgs: Record<string, unknown>;
  try {
    rawArgs = JSON.parse(toolCall.function.arguments);
  } catch {
    diagnostics.push(`Invalid JSON in tool arguments for "${toolName}"`);
    return { ok: false, diagnostics };
  }

  const semanticAction: Record<string, unknown> = {
    type: actionType,
    ...rawArgs,
  };

  const compileResult = compileSemanticAction(semanticAction as SemanticAction);

  if (!compileResult.ok) {
    const messages = compileResult.diagnostics.map(
      (d: { code: string; message: string }) => `[${d.code}] ${d.message}`,
    );
    return {
      ok: false,
      action: semanticAction as SemanticAction,
      compileResult,
      diagnostics: [`Compilation failed for "${toolName}":`, ...messages],
    };
  }

  return {
    ok: true,
    action: semanticAction as SemanticAction,
    compileResult,
    diagnostics: [],
  };
}

export function processModelResponse(
  toolCalls: ModelToolCall[],
  registry: ToolRegistry,
): ConvertResult[] {
  return toolCalls.map((call) => convertModelResponse(call, registry));
}
