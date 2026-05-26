import type { SemanticDiagnostic } from "./types.js";

export function diagnostic(
  code: string,
  message: string,
  stage = "compiler",
): SemanticDiagnostic {
  return { code, message, severity: "error", stage };
}
