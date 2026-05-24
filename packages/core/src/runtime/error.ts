import { HandlerError } from "../engine/error.js";

export class RuntimeHandlerError extends HandlerError {
  readonly nodeId?: string;

  constructor(
    code: string,
    message: string,
    actionType?: string,
    nodeId?: string,
  ) {
    super(code, message, actionType);
    this.name = "RuntimeHandlerError";
    this.nodeId = nodeId;
  }
}
