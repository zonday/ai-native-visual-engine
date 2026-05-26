import { HandlerError } from "../engine/error.js";

export class DocumentHandlerError extends HandlerError {
  readonly pageId?: string;

  constructor(
    code: string,
    message: string,
    actionType?: string,
    pageId?: string,
  ) {
    super(code, message, actionType, pageId ? { pageId } : {});
    this.name = "DocumentHandlerError";
    this.pageId = pageId;
  }
}
