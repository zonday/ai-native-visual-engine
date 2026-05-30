import { ActionRegistry, splitRegistry } from "../engine/action-registry.js";
import type { RuntimeContext } from "../engine/handler.js";
import type { SceneGraph } from "../types.js";
import type { RuntimeAction } from "./actions.js";
import type { DispatchResult } from "./command-bus.js";
import type {
  InverseRegistry,
  RuntimeHandlerEntry,
  RuntimeHandlerRegistry,
} from "./handler-registry.js";
import { createNodeEntry } from "./handlers/create-node.js";
import { moveNodeEntry } from "./handlers/move-node.js";
import { removeNodeEntry } from "./handlers/remove-node.js";
import { rotateNodeEntry } from "./handlers/rotate-node.js";
import { updateBindingsEntry } from "./handlers/update-bindings.js";
import { updateLayoutEntry } from "./handlers/update-layout.js";
import { updatePropsEntry } from "./handlers/update-props.js";
import { updateRuntimeEntry } from "./handlers/update-runtime.js";
import { updateSelectionEntry } from "./handlers/update-selection.js";
import { updateStyleEntry } from "./handlers/update-style.js";

function entry(
  h: RuntimeHandlerEntry["handler"],
  i: RuntimeHandlerEntry["inverse"],
): any {
  return {
    handler: h,
    inverse: i,
    meta: { undoable: true, mergeable: false, devtoolsLabel: "" },
  };
}

export function createRuntimeRegistry(
  _batchDispatch: (action: RuntimeAction) => DispatchResult,
): ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext> {
  const registry = new ActionRegistry<
    RuntimeAction,
    SceneGraph,
    RuntimeContext
  >();
  registry.register(
    "create-node",
    entry(
      createNodeEntry.handler as RuntimeHandlerEntry["handler"],
      createNodeEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "remove-node",
    entry(
      removeNodeEntry.handler as RuntimeHandlerEntry["handler"],
      removeNodeEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "move-node",
    entry(
      moveNodeEntry.handler as RuntimeHandlerEntry["handler"],
      moveNodeEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "update-layout",
    entry(
      updateLayoutEntry.handler as RuntimeHandlerEntry["handler"],
      updateLayoutEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "rotate-node",
    entry(
      rotateNodeEntry.handler as RuntimeHandlerEntry["handler"],
      rotateNodeEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "update-props",
    entry(
      updatePropsEntry.handler as RuntimeHandlerEntry["handler"],
      updatePropsEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "update-style",
    entry(
      updateStyleEntry.handler as RuntimeHandlerEntry["handler"],
      updateStyleEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "update-bindings",
    entry(
      updateBindingsEntry.handler as RuntimeHandlerEntry["handler"],
      updateBindingsEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "update-runtime",
    entry(
      updateRuntimeEntry.handler as RuntimeHandlerEntry["handler"],
      updateRuntimeEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register(
    "update-selection",
    entry(
      updateSelectionEntry.handler as RuntimeHandlerEntry["handler"],
      updateSelectionEntry.inverse as RuntimeHandlerEntry["inverse"],
    ),
  );
  registry.register("batch-actions", registry.createBatchEntry() as any);
  return registry;
}

/** @deprecated Use createRuntimeRegistry + ActionRegistry instead */
export function createDefaultRuntimeRegistries(
  batchDispatch: (action: RuntimeAction) => DispatchResult,
): {
  handlerRegistry: RuntimeHandlerRegistry;
  inverseRegistry: InverseRegistry;
} {
  const registry = createRuntimeRegistry(batchDispatch);
  const split = splitRegistry(registry);
  return {
    handlerRegistry: split.handlerRegistry as unknown as RuntimeHandlerRegistry,
    inverseRegistry: split.inverseRegistry as unknown as InverseRegistry,
  };
}
