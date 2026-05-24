import { describe, it, expect } from "vitest";
import { documentValidatorMiddleware } from "../src/document/middleware/validator.js";
import type { VisualDocument } from "../src/types.js";
import type { DocumentAction } from "../src/document/actions.js";

const emptyDoc: VisualDocument = {
  id: "doc-1",
  title: "Test",
  pages: [],
  scenes: {},
};

describe("documentValidatorMiddleware", () => {
  it("passes valid action through to next", () => {
    let nextCalled = false;
    const result = documentValidatorMiddleware(
      { type: "rename-page", pageId: "p1", name: "New" },
      emptyDoc,
      () => {
        nextCalled = true;
        return { ok: true, state: emptyDoc };
      },
    );
    expect(result.ok).toBe(true);
    expect(nextCalled).toBe(true);
  });

  it("rejects invalid action with validation.action-schema-mismatch", () => {
    const result = documentValidatorMiddleware(
      { type: "create-page", page: { id: "p1" } } as unknown as DocumentAction,
      emptyDoc,
      () => ({ ok: true, state: emptyDoc }),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("validation.action-schema-mismatch");
  });

  it("returns original document unchanged on validation failure", () => {
    const result = documentValidatorMiddleware(
      { type: "unknown-action" } as unknown as DocumentAction,
      emptyDoc,
      () => ({ ok: true, state: emptyDoc }),
    );
    expect(result.ok).toBe(false);
    expect(result.state).toBe(emptyDoc);
  });

  it("includes actionType in error for invalid actions", () => {
    const result = documentValidatorMiddleware(
      { type: "reorder-page", pageId: "p1", index: "not-a-number" } as unknown as DocumentAction,
      emptyDoc,
      () => ({ ok: true, state: emptyDoc }),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.actionType).toBe("reorder-page");
  });
});
