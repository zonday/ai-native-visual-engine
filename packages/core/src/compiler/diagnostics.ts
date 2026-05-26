import type { ZodError } from "zod/v4";
import type { SemanticDiagnostic } from "./types.js";

export function diagnostic(
  code: string,
  message: string,
  stage = "compiler",
): SemanticDiagnostic {
  return { code, message, severity: "error", stage };
}

export function formatZodIssues(error: ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
}

export function createDiagnosticFactory(stageName: string) {
  return (code: string, message: string): SemanticDiagnostic => ({
    code,
    message,
    severity: "error",
    stage: stageName,
  });
}

export function unsupportedAction(
  stageName: string,
  actionType: string,
): SemanticDiagnostic {
  return {
    code: "compiler.unsupported-action",
    message: `Unsupported action type: ${actionType}`,
    severity: "error",
    stage: stageName,
  };
}
