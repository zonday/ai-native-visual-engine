import type { YjsDocProvider } from "./yjs-provider.js";
import type { RuntimeAction } from "../runtime/actions.js";

export interface CollaborationOptions {
  readonly?: boolean;
  onRemoteAction?: () => void;
  clearRedoStack?: () => void;
  getActorId?: () => string;
}

export function createCollaborationMiddleware(
  provider: YjsDocProvider,
  options: CollaborationOptions = {},
) {
  let remoteAction = false;

  const unsub = provider.onRemoteAction(() => {
    remoteAction = true;
    try {
      options.clearRedoStack?.();
      options.onRemoteAction?.();
    } finally {
      remoteAction = false;
    }
  });

  return {
    middleware: <TState>(
      action: RuntimeAction,
      _state: TState,
      next: () => { ok: boolean; state: TState; error?: { code: string; message: string; actionType?: string } },
    ) => {
      if (options.readonly) {
        return remoteAction ? next() : {
          ok: false,
          state: _state,
          error: { code: "collaboration.readonly", message: "Read-only observer" },
        };
      }

      if (remoteAction) {
        return next();
      }

      const result = next();
      if (result.ok) {
        provider.broadcastAction(action);
      }
      return result;
    },
    dispose() {
      unsub();
    },
  };
}
