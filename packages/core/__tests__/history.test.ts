import { describe, expect, it } from "vitest";
import type { DocumentAction } from "../src/document/register-handlers.js";
import {
  createHistoryState,
  type HistoryState,
  pushUndo,
  redoAction,
  replayActions,
  undoAction,
} from "../src/engine/history.js";

const createDocumentHistoryState = createHistoryState<DocumentAction>;
const pushDocumentUndo = pushUndo<DocumentAction>;
const undoDocumentAction = undoAction<DocumentAction>;
const redoDocumentAction = redoAction<DocumentAction>;
type DocumentHistoryState = HistoryState<DocumentAction>;

function makeEntry(
  action: DocumentAction,
  inverse?: DocumentAction,
): DocumentHistoryEntry {
  return {
    action,
    inverseAction: inverse,
    timestamp: Date.now(),
    actorId: "test-user",
  };
}

type DocumentHistoryEntry = {
  action: DocumentAction;
  inverseAction?: DocumentAction;
  timestamp: number;
  actorId?: string;
};

describe("DocumentHistoryState", () => {
  describe("createDocumentHistoryState", () => {
    it("creates empty state with no undo or redo entries", () => {
      const state = createDocumentHistoryState();
      expect(state.undoStack).toHaveLength(0);
      expect(state.redoStack).toHaveLength(0);
    });
  });

  describe("pushDocumentUndo", () => {
    it("pushes entry onto undo stack", () => {
      const state = createDocumentHistoryState();
      const entry = makeEntry({
        type: "rename-page",
        pageId: "p1",
        name: "New",
      });
      const next = pushDocumentUndo(state, entry);
      expect(next.undoStack).toHaveLength(1);
      expect(next.undoStack[0]).toBe(entry);
    });

    it("clears redo stack on push", () => {
      const state: DocumentHistoryState = {
        undoStack: [],
        redoStack: [
          makeEntry({ type: "rename-page", pageId: "p1", name: "Old" }),
        ],
      };
      const entry = makeEntry({
        type: "rename-page",
        pageId: "p1",
        name: "New",
      });
      const next = pushDocumentUndo(state, entry);
      expect(next.redoStack).toHaveLength(0);
    });

    it("evicts oldest entries when exceeding max stack size", () => {
      const state = createDocumentHistoryState();
      let current = state;
      for (let i = 0; i < 202; i++) {
        current = pushDocumentUndo(
          current,
          makeEntry({ type: "rename-page", pageId: "p1", name: `Name ${i}` }),
          200,
        );
      }
      expect(current.undoStack).toHaveLength(200);
    });
  });

  describe("undoDocumentAction", () => {
    it("returns null when undo stack is empty", () => {
      const state = createDocumentHistoryState();
      const result = undoDocumentAction(state);
      expect(result).toBeNull();
    });

    it("returns null when top entry has no inverseAction", () => {
      const state: DocumentHistoryState = {
        undoStack: [
          {
            action: { type: "rename-page", pageId: "p1", name: "New" },
            timestamp: 0,
          },
        ],
        redoStack: [],
      };
      const result = undoDocumentAction(state);
      expect(result).toBeNull();
    });

    it("pops from undo stack and pushes to redo stack", () => {
      const inverseAction: DocumentAction = {
        type: "rename-page",
        pageId: "p1",
        name: "Old",
      };
      const entry = makeEntry(
        { type: "rename-page", pageId: "p1", name: "New" },
        inverseAction,
      );
      const state: DocumentHistoryState = {
        undoStack: [entry],
        redoStack: [],
      };
      const result = undoDocumentAction(state);
      expect(result).not.toBeNull();
      expect(result?.state.undoStack).toHaveLength(0);
      expect(result?.state.redoStack).toHaveLength(1);
      expect(result?.state.redoStack[0]).toBe(entry);
      expect(result?.inverseAction).toEqual(inverseAction);
    });

    it("undoes multiple actions in LIFO order", () => {
      const entry1 = makeEntry(
        { type: "rename-page", pageId: "p1", name: "Second" },
        { type: "rename-page", pageId: "p1", name: "First" },
      );
      const entry2 = makeEntry(
        { type: "rename-page", pageId: "p1", name: "Third" },
        { type: "rename-page", pageId: "p1", name: "Second" },
      );
      const state: DocumentHistoryState = {
        undoStack: [entry1, entry2],
        redoStack: [],
      };
      const result1 = undoDocumentAction(state);
      expect(result1?.inverseAction).toEqual(entry2.inverseAction);

      const result2 = undoDocumentAction(
        result1?.state as DocumentHistoryState,
      );
      expect(result2?.inverseAction).toEqual(entry1.inverseAction);
      expect(result2?.state.undoStack).toHaveLength(0);
      expect(result2?.state.redoStack).toHaveLength(2);
    });
  });

  describe("redoDocumentAction", () => {
    it("returns null when redo stack is empty", () => {
      const state = createDocumentHistoryState();
      const result = redoDocumentAction(state);
      expect(result).toBeNull();
    });

    it("pops from redo stack and pushes to undo stack", () => {
      const action: DocumentAction = {
        type: "rename-page",
        pageId: "p1",
        name: "New",
      };
      const entry = makeEntry(action, {
        type: "rename-page",
        pageId: "p1",
        name: "Old",
      });
      const state: DocumentHistoryState = {
        undoStack: [],
        redoStack: [entry],
      };
      const result = redoDocumentAction(state);
      expect(result).not.toBeNull();
      expect(result?.state.redoStack).toHaveLength(0);
      expect(result?.state.undoStack).toHaveLength(1);
      expect(result?.action).toEqual(action);
    });
  });

  describe("undo/redo round-trip", () => {
    it("undo then redo restores history stacks", () => {
      const action: DocumentAction = {
        type: "rename-page",
        pageId: "p1",
        name: "New",
      };
      const inverseAction: DocumentAction = {
        type: "rename-page",
        pageId: "p1",
        name: "Old",
      };
      const entry = makeEntry(action, inverseAction);

      let state: DocumentHistoryState = {
        undoStack: [entry],
        redoStack: [],
      };

      const undoResult = undoDocumentAction(state as DocumentHistoryState);
      expect(undoResult).not.toBeNull();
      state = undoResult?.state as DocumentHistoryState;
      expect(state.undoStack).toHaveLength(0);
      expect(state.redoStack).toHaveLength(1);

      const redoResult = redoDocumentAction(state as DocumentHistoryState);
      expect(redoResult).not.toBeNull();
      state = redoResult?.state as DocumentHistoryState;
      expect(state.undoStack).toHaveLength(1);
      expect(state.redoStack).toHaveLength(0);
      expect(redoResult?.action).toEqual(action);
    });
  });

  describe("setCheckpoint", () => {
    it("blocks undo at the checkpoint boundary", () => {
      const entry1 = makeEntry(
        { type: "rename-page", pageId: "p1", name: "Second" },
        { type: "rename-page", pageId: "p1", name: "First" },
      );
      const entry2 = makeEntry(
        { type: "rename-page", pageId: "p1", name: "Third" },
        { type: "rename-page", pageId: "p1", name: "Second" },
      );
      const state: DocumentHistoryState = {
        undoStack: [entry1, entry2],
        redoStack: [],
        checkpointIndex: 1, // checkpoint after entry1
      };
      const result = undoDocumentAction(state);
      expect(result).not.toBeNull();
      expect(result?.state.undoStack).toHaveLength(1);

      const result2 = undoDocumentAction(result?.state as DocumentHistoryState);
      expect(result2).toBeNull();
    });
  });

  describe("replayActions", () => {
    it("applies all entries in order and returns ok", () => {
      const actions: DocumentAction[] = [
        { type: "rename-page", pageId: "p1", name: "A" },
        { type: "rename-page", pageId: "p1", name: "B" },
      ];
      const applied: DocumentAction[] = [];
      const dispatch = (a: DocumentAction) => {
        applied.push(a);
        return { ok: true };
      };
      const entries = actions.map((a) => makeEntry(a));
      const result = replayActions(entries, dispatch); // using document version
      expect(result.ok).toBe(true);
      expect(applied).toHaveLength(2);
    });

    it("stops and returns failedAt on first error", () => {
      const actions: DocumentAction[] = [
        { type: "rename-page", pageId: "p1", name: "A" },
        { type: "rename-page", pageId: "p2", name: "B" },
      ];
      let callCount = 0;
      const dispatch = (_a: DocumentAction) => {
        callCount++;
        if (callCount === 2) return { ok: false };
        return { ok: true };
      };
      const entries = actions.map((a) => makeEntry(a));
      const result = replayActions(entries, dispatch);
      expect(result.ok).toBe(false);
      expect(result.failedAt).toBe(1);
    });
  });
});
