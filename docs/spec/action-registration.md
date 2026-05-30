# Action Registration

## 1. Scope

This document defines how action handlers and inverse computers are defined, registered, and discovered by the command bus and transaction manager.

Both scene runtime actions (`RuntimeAction`) and document actions (`DocumentAction`) follow the same registration pattern. The engine layer provides generic infrastructure; domain-specific layers (runtime, document) specialize it.

## 2. Handler Entry

Every action handler and its inverse are paired into a single `HandlerEntry` value:

```ts
// engine/handler-registry.ts
export interface HandlerEntry<
  TState,
  TAction,
  TContext extends RuntimeContext,
> {
  handler: Handler<TState, TAction, TContext>;
  inverse: InverseComputer<TState, TAction, TContext>;
}
```

Each action type has exactly one module file that exports its `HandlerEntry`. The module file is the single source of truth for that action's handler and inverse logic.

### 2.1 Handler File Convention

```
handlers/
  create-node.ts     → export const createNode: HandlerEntry
  remove-node.ts     → export const removeNode: HandlerEntry
  move-node.ts       → export const moveNode: HandlerEntry
  ...
```

Each file exports one named constant using `satisfies`:

```ts
// handlers/create-node.ts
import type { SceneGraph } from "../../types.js";
import type { CreateNodeAction } from "../actions.js";
import type { RuntimeContext } from "../handler-registry.js";
import { HandlerError } from "../../engine/error.js";

export const createNode = {
  handler(scene: SceneGraph, action: CreateNodeAction, _ctx: RuntimeContext): SceneGraph {
    if (scene.nodes[action.node.id]) {
      throw new HandlerError(
        "scene.duplicate-node-id",
        `Node ID "${action.node.id}" already exists`,
        "create-node",
        { nodeId: action.node.id },
      );
    }
    if (action.parentId !== "root" && !scene.nodes[action.parentId]) {
      throw new HandlerError(
        "scene.invalid-parent",
        `Parent "${action.parentId}" not found`,
        "create-node",
        { nodeId: action.parentId },
      );
    }

    const node = { ...action.node, parentId: action.parentId };
    const children = [...(scene.nodes[action.parentId]?.children ?? []), node.id];
    const parent = scene.nodes[action.parentId]
      ? { ...scene.nodes[action.parentId], children }
      : undefined;

    return {
      ...scene,
      nodes: {
        ...scene.nodes,
        [node.id]: node,
        ...(parent ? { [action.parentId]: parent } : {}),
      },
    };
  },
  inverse(_sceneBefore: SceneGraph, action: CreateNodeAction, _ctx: RuntimeContext) {
    return { type: "remove-node" as const, nodeId: action.node.id };
  },
} satisfies HandlerEntry<SceneGraph, CreateNodeAction, RuntimeContext>;
```

Rules:

1. The export name matches the action type in camelCase (`create-node` → `createNode`).
2. `satisfies` checks the type without widening, preserving the exact function signature for inference.
3. The handler and inverse share the module scope and can access the same imports and utilities.
4. No action-type string literal is repeated in the export — the consumer supplies it at registration time.

## 3. ActionRegistry

The `ActionRegistry` class keeps all `HandlerEntry` values in a single map, providing both handler and inverse lookup from one object:

```ts
// engine/handler-registry.ts
export class ActionRegistry<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> {
  private entries = new Map<string, HandlerEntry<TState, TAction, TContext>>();

  register<TA extends TAction>(
    type: TA["type"],
    entry: HandlerEntry<TState, TA, TContext>,
  ): void {
    this.entries.set(type, entry as HandlerEntry<TState, TAction, TContext>);
  }

  getHandler(type: string): Handler<TState, TAction, TContext> | undefined {
    return this.entries.get(type)?.handler;
  }

  getInverse(type: string): InverseComputer<TState, TAction, TContext> | undefined {
    return this.entries.get(type)?.inverse;
  }

  getEntry(type: string): HandlerEntry<TState, TAction, TContext> | undefined {
    return this.entries.get(type);
  }
}
```

The type cast in `register()` is the only cast in the system. External callers never cast.

### 3.1 Batch Actions

Batch actions (`batch-actions` / `batch-document-actions`) are the one action type whose handler factory and inverse factory depend on the registry itself. `ActionRegistry` provides a method to create the batch entry:

```ts
class ActionRegistry<TState, TAction extends { type: string }, TContext extends RuntimeContext> {
  createBatchEntry(type: TAction["type"]): HandlerEntry<TState, TAction, TContext> {
    const self = this;
    return {
      handler: ((scene: TState, action: TAction, context: TContext) => {
        const batch = action as unknown as { actions: TAction[] };
        let current = scene;
        for (const child of batch.actions) {
          const entry = self.getEntry(child.type);
          if (!entry) return scene;
          current = entry.handler(current, child, context);
        }
        return current;
      }) as Handler<TState, TAction, TContext>,

      inverse: ((sceneBefore: TState, action: TAction, context: TContext) => {
        const batch = action as unknown as { actions: TAction[] };
        const inverses: TAction[] = [];
        let current = sceneBefore;
        for (const child of batch.actions) {
          const inv = self.getInverse(child.type)?.(current, child, context);
          if (inv) inverses.push(inv);
          const entry = self.getEntry(child.type);
          if (entry) current = entry.handler(current, child, context);
        }
        if (inverses.length === 0) return undefined;
        if (inverses.length === 1) return inverses[0];
        return { type: action.type, actions: inverses.reverse() } as TAction;
      }) as InverseComputer<TState, TAction, TContext>,
    };
  }
}
```

## 4. Registration

### 4.1 Registration Module

Each domain (runtime, document) has one registration module that imports all handler entries, type-checks exhaustiveness, and builds the registry:

```ts
// runtime/register-handlers.ts
import { ActionRegistry } from "../engine/handler-registry.js";
import { createNode } from "./handlers/create-node.js";
import { removeNode } from "./handlers/remove-node.js";
import { moveNode } from "./handlers/move-node.js";
import { updateLayout } from "./handlers/update-layout.js";
import { rotateNode } from "./handlers/rotate-node.js";
import { updateProps } from "./handlers/update-props.js";
import { updateStyle } from "./handlers/update-style.js";
import { updateBindings } from "./handlers/update-bindings.js";
import { updateRuntime } from "./handlers/update-runtime.js";
import { updateSelection } from "./handlers/update-selection.js";
import type { RuntimeAction } from "./actions.js";
import type { SceneGraph, RuntimeContext } from "../types.js"; // or engine/handler

type NonBatchAction = Exclude<RuntimeAction, { type: "batch-actions" }>;

type ActionHandlerMap = {
  [K in NonBatchAction["type"]]: HandlerEntry<
    SceneGraph,
    Extract<NonBatchAction, { type: K }>,
    RuntimeContext
  >;
};

const handlerMap: ActionHandlerMap = {
  "create-node": createNode,
  "remove-node": removeNode,
  "move-node": moveNode,
  "update-layout": updateLayout,
  "rotate-node": rotateNode,
  "update-props": updateProps,
  "update-style": updateStyle,
  "update-bindings": updateBindings,
  "update-runtime": updateRuntime,
  "update-selection": updateSelection,
};

export function createRuntimeRegistry(): ActionRegistry<
  SceneGraph,
  RuntimeAction,
  RuntimeContext
> {
  const registry = new ActionRegistry<SceneGraph, RuntimeAction, RuntimeContext>();

  for (const [type, entry] of Object.entries(handlerMap)) {
    registry.register(type, entry);
  }

  registry.register("batch-actions", registry.createBatchEntry("batch-actions"));

  return registry;
}
```

### 4.2 Exhaustiveness

The `ActionHandlerMap` mapped type ensures at compile time that every `RuntimeAction["type"]` branch (except batch) has a corresponding entry. Adding a new action type to `RuntimeAction` but not to `handlerMap` produces a TypeScript error.

The same pattern applies to the document domain:

```ts
// document/register-handlers.ts
type NonBatchDocAction = Exclude<DocumentAction, { type: "batch-document-actions" }>;

type DocumentActionHandlerMap = {
  [K in NonBatchDocAction["type"]]: HandlerEntry<
    VisualDocument,
    Extract<NonBatchDocAction, { type: K }>,
    DocumentRuntimeContext
  >;
};

const handlerMap: DocumentActionHandlerMap = {
  "create-page": createPage,
  "remove-page": removePage,
  "rename-page": renamePage,
  "reorder-page": reorderPage,
  "update-page-route": updatePageRoute,
  "set-document-theme": setDocumentTheme,
  "set-page-theme": setPageTheme,
};
```

### 4.3 Backward Compatibility

The existing engine `buildRegistriesFromEntries` function and the `HandlerRegistry`/`InverseRegistry` map types are preserved for transition. A `splitRegistry()` helper converts an `ActionRegistry` into the two-map form if needed:

```ts
export function splitRegistry<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
>(
  registry: ActionRegistry<TState, TAction, TContext>,
): {
  handlerRegistry: HandlerRegistry<TState, TAction, TContext>;
  inverseRegistry: InverseRegistry<TAction>;
} {
  const entries: [string, HandlerEntry<TState, TAction, TContext>][] = [];
  for (const type of registry.getActionTypes()) {
    const entry = registry.getEntry(type);
    if (entry) entries.push([type, entry]);
  }
  return buildRegistriesFromEntries(entries);
}
```

## 5. Consumption

### 5.1 Command Bus

The command bus receives the `ActionRegistry` and calls `getHandler()` by action type:

```ts
// engine/command-bus.ts
export function createCommandBus<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
>(
  registry: HandlerRegistry<TState, TAction, TContext>,
  // ...
) {
  // uses registry.get(action.type) — unchanged
}
```

When transitioned fully, the command bus would accept `ActionRegistry` directly and call `registry.getHandler(action.type)` instead of `registry.get(action.type)?.handler`.

### 5.2 Transaction Manager

The transaction manager receives the `ActionRegistry` for both handler dispatch and inverse computation:

```ts
// engine/transaction-manager.ts
export interface TransactionManagerConfig<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> {
  actionRegistry: ActionRegistry<TState, TAction, TContext>;
  dispatch?: (action: TAction) => DispatchResult<TState>;
  validate?: (action: TAction) => { ok: boolean; error?: { code: string; message: string } };
}
```

The manager calls `actionRegistry.getHandler(type)` for applying actions and `actionRegistry.getInverse(type)` for computing undo.

## 6. Adding a New Action

Adding a new action type requires touching exactly these files:

| File | Change |
|------|--------|
| `actions.ts` | Add the action schema and type to the union |
| `handlers/create-foo.ts` | New file: export the `HandlerEntry` object |
| `register-handlers.ts` | Import the new entry and add it to `handlerMap` |
| `runtime-engine.md` (or `document-runtime.md`) | Document the action behavior |

The `ActionHandlerMap` mapped type catches any missing registration at compile time.

## 7. Cross-Handler Dependencies

Handler files must not import from other handler files. Shared utilities (such as route normalization) must live in a separate utility module:

```
handlers/
  update-page-route.ts   imports normalizeRoute from ../normalize-route.js
  create-page.ts         imports normalizeRoute from ../normalize-route.js
  normalize-route.ts     exports normalizeRoute (pure utility, no handler/inverse)
```

This keeps the dependency graph acyclic at the handler layer and allows any handler to be tested in isolation.
