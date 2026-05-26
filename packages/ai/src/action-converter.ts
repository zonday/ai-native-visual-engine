import type { CompileResult } from "@ai-native/core";
import { ALL_TOOLS } from "./tool-registry.js";

export interface ToolCallResult {
  toolName: string;
  ok: boolean;
  compileResult: CompileResult;
  diagnostics: string[];
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  const tool = ALL_TOOLS[toolName];

  if (!tool) {
    return {
      toolName,
      ok: false,
      compileResult: { ok: false, diagnostics: [] },
      diagnostics: [
        `Unknown tool: "${toolName}". Available: ${Object.keys(ALL_TOOLS).join(", ")}`,
      ],
    };
  }

  try {
    if (!tool.execute) {
      return {
        toolName,
        ok: false,
        compileResult: { ok: false, diagnostics: [] },
        diagnostics: [`Tool "${toolName}" has no execute function`],
      };
    }
    const result = await tool.execute(args, {
      toolCallId: "manual",
      messages: [],
    });
    return {
      toolName,
      ok: true,
      compileResult: result as CompileResult,
      diagnostics: [],
    };
  } catch (err) {
    return {
      toolName,
      ok: false,
      compileResult: { ok: false, diagnostics: [] },
      diagnostics: [
        `Tool execution failed for "${toolName}": ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}

export async function executeAllToolCalls(
  calls: Array<{ toolName: string; args: Record<string, unknown> }>,
): Promise<ToolCallResult[]> {
  return Promise.all(calls.map((c) => executeToolCall(c.toolName, c.args)));
}