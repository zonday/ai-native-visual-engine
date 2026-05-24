export class DocumentHandlerError extends Error {
  code: string;
  actionType?: string;
  pageId?: string;

  constructor(
    code: string,
    message: string,
    actionType?: string,
    pageId?: string,
  ) {
    super(message);
    this.code = code;
    this.actionType = actionType;
    this.pageId = pageId;
  }
}
