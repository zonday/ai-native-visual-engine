import type { DocumentAction } from "../document/actions.js";
import type { RuntimeAction } from "../runtime/actions.js";
import type { PageId } from "../types.js";
import type { YjsDocProvider } from "./yjs-provider.js";

export interface CollaborationOptions {
  readonly?: boolean;
  clearRedoStack?: () => void;
  getActorId?: () => string;
  getActivePageId?: () => PageId | undefined;
}

export function createCollaborationMiddleware(
  provider: YjsDocProvider,
  options: CollaborationOptions = {},
) {
  let remoteAction = false;

  const onRemoteDoc = () => {
    remoteAction = true;
    try {
      options.clearRedoStack?.();
    } finally {
      remoteAction = false;
    }
  };

  const onRemoteScene = () => {
    remoteAction = true;
    try {
      options.clearRedoStack?.();
    } finally {
      remoteAction = false;
    }
  };

  const unsubDoc = provider.onRemoteDocumentAction(onRemoteDoc);
  const unsubScene = provider.onRemoteSceneAction(
    options.getActivePageId?.() ?? "default",
    onRemoteScene,
  );

  return {
    documentMiddleware: <TState>(
      action: DocumentAction,
      state: TState,
      next: () => {
        ok: boolean;
        state: TState;
        error?: { code: string; message: string };
      },
    ) => {
      if (options.readonly) {
        return remoteAction
          ? next()
          : { ok: false, state, error: { code: "collaboration.readonly" } };
      }
      if (remoteAction) return next();

      const result = next();
      if (result.ok) {
        provider.broadcastDocumentAction({
          actorId: options.getActorId?.() ?? "unknown",
          timestamp: Date.now(),
          action,
        });
      }
      return result;
    },

    sceneMiddleware: <TState>(
      action: RuntimeAction,
      state: TState,
      next: () => {
        ok: boolean;
        state: TState;
        error?: { code: string; message: string };
      },
    ) => {
      if (options.readonly) {
        return remoteAction
          ? next()
          : { ok: false, state, error: { code: "collaboration.readonly" } };
      }
      if (remoteAction) return next();

      const result = next();
      if (result.ok) {
        provider.broadcastSceneAction({
          actorId: options.getActorId?.() ?? "unknown",
          timestamp: Date.now(),
          pageId: options.getActivePageId?.() ?? "default",
          action,
        });
      }
      return result;
    },

    dispose() {
      unsubDoc();
      unsubScene();
    },
  };
}
