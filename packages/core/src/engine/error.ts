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

export interface RendererError extends EngineError {
  domain: "renderer";
  nodeId: string;
  componentType: string;
}

export class HandlerError extends Error {
  readonly code: string;
  readonly actionType?: string;
  readonly context: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    actionType?: string,
    context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "HandlerError";
    this.code = code;
    this.actionType = actionType;
    this.context = context;
  }
}
