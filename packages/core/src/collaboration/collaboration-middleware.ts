import type { YjsDocProvider } from "./yjs-provider.js";
import type { RuntimeAction } from "../runtime/actions.js";

export function createCollaborationMiddleware(
  provider: YjsDocProvider,
) {
  let remoteAction = false;

  const unsub = provider.onRemoteAction(() => {
    remoteAction = true;
    try {
      // Remote actions applied — prevent re-broadcast
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
