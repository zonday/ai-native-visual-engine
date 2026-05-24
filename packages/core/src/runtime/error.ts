export class RuntimeHandlerError extends Error {
  readonly code: string;
  readonly actionType?: string;
  readonly nodeId?: string;

  constructor(
    code: string,
    message: string,
    actionType?: string,
    nodeId?: string,
  ) {
    super(message);
    this.name = "RuntimeHandlerError";
    this.code = code;
    this.actionType = actionType;
    this.nodeId = nodeId;
  }
}
