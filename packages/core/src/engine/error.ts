export class HandlerError extends Error {
  readonly code: string;
  readonly actionType?: string;

  constructor(code: string, message: string, actionType?: string) {
    super(message);
    this.name = "HandlerError";
    this.code = code;
    this.actionType = actionType;
  }
}
