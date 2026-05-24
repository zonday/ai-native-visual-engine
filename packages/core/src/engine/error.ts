export type ErrorSeverity = "fatal" | "error" | "warning";

export type ErrorDomain =
  | "document"
  | "scene"
  | "compiler"
  | "renderer"
  | "plugin"
  | "import-export"
  | "collaboration"
  | "validation";

export interface EngineError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  domain: ErrorDomain;
  recoverable: boolean;
  context?: Record<string, unknown>;
}

export interface CompilerDiagnostic {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface RendererError extends EngineError {
  domain: "renderer";
  nodeId: string;
  componentType: string;
}

export class HandlerError extends Error {
  readonly code: string;
  readonly actionType?: string;

  constructor(code: string, message: string, actionType?: string) {
    super(message);
    this.name = "HandlerError";
    this.code = code;
    this.actionType = actionType;
  }

  toEngineError(): EngineError {
    const domain: ErrorDomain = this.code.startsWith("document.")
      ? "document"
      : this.code.startsWith("scene.")
        ? "scene"
        : "validation";

    return {
      code: this.code,
      message: this.message,
      severity: domain === "validation" ? "error" : "error",
      domain,
      recoverable: true,
      context: this.actionType ? { actionType: this.actionType } : undefined,
    };
  }
}
