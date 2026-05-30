# Action Registration

## 1. Scope

This document defines how action handlers and inverse computers are defined, registered, and discovered by the command bus and transaction manager.

Both scene runtime actions (`RuntimeAction`) and document actions (`DocumentAction`) follow the same pattern. The engine layer provides the generic type infrastructure; domain-specific layers (runtime, document) specialize with their own action union and state type.

## 2. Handler Entry

Every action handler, its inverse, its validation rule, and its metadata are co-located in a single `HandlerEntry` value:

```ts
// engine/handler-registry.ts
export interface ActionMeta {
  undoable: boolean;
  mergeable: boolean;
  historyGroup?: string;
  devtoolsLabel?: string;
}

export interface HandlerEntry<
  TState,
  TAction,
  TContext extends RuntimeContext,
> {
  handler: Handler<TState, TAction, TContext>;
  inverse: InverseComputer<TState, TAction, TContext>;
  validate?: (action: TAction) => { ok: boolean; error?: { code: string; message: string; } };
  meta: ActionMeta;
}
```

Each action type has exactly one module file that exports its `HandlerEntry`. The module file is the single source of truth.

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
    const parentId = scene.nodes[action.parentId] ? action.parentId : "root";
    const node = { ...action.node, parentId };
    const children = [
      ...(scene.nodes[parentId]?.children ?? []),
      node.id,
    ];
    const parent = { ...scene.nodes[parentId], children };
    return {
      ...scene,
      nodes: { ...scene.nodes, [node.id]: node, [parentId]: parent },
    };
  },
  inverse(_sceneBefore: SceneGraph, action: CreateNodeAction, _ctx: RuntimeContext) {
    return { type: "remove-node" as const, nodeId: action.node.id };
  },
  validate(action: CreateNodeAction) {
    if (!action.node.id) return { ok: false, error: { code: "missing-id", message: "Node ID is required" } };
    if (!action.node.type) return { ok: false, error: { code: "missing-type", message: "Node type is required" } };
    return { ok: true };
  },
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Create Node" },
} satisfies HandlerEntry<SceneGraph, CreateNodeAction, RuntimeContext>;
```

Rules:

1. The export name matches the action type in camelCase (`create-node` → `createNode`).
2. `satisfies` checks the type without widening, preserving the exact function signature for inference.
3. Handler, inverse, and validate share the module scope and access the same imports and utilities.
4. No action-type string literal is repeated in the export — the consumer supplies it at registration time.
5. `meta` is required. Every action declares whether it is undoable and mergeable.

### 2.2 Meta Defaults

For actions that are trivially undoable (every inverse action exists and is correct) and not mergeable, a convenience constant avoids repetition:

```ts
export const STANDARD_ACTION_META: ActionMeta = {
  undoable: true,
  mergeable: false,
};
```

## 3. HandlerMap

Rather than a `Map<string, HandlerEntry>` (which loses exact action-type information), the registry uses a typed record — a `HandlerMap`:

```ts
// engine/handler-registry.ts
export type HandlerMap<TAction extends { type: string }, TState, TContext extends RuntimeContext> = {
  [K in TAction["type"]]: HandlerEntry<TState, Extract<TAction, { type: K }>, TContext>;
};
```

This is the key type. For any union type `RuntimeAction`, indexing `HandlerMap` with a literal key returns the exact `HandlerEntry` for that specific action, with zero casts:

```ts
type Map = HandlerMap<RuntimeAction, SceneGraph, RuntimeContext>;
//   Map["create-node"] → HandlerEntry<SceneGraph, CreateNodeAction, RuntimeContext>
//   Map["remove-node"] → HandlerEntry<SceneGraph, RemoveNodeAction, RuntimeContext>
```

### 3.1 Batch Action

Batch is a generic action type — not a specific action, but a container that can hold any `TAction`:

```ts
// engine/handler-registry.ts
export interface BatchAction<TAction extends { type: string }> {
  type: "batch-actions";
  actions: TAction[];
}
```

The runtime action union includes it:

```ts
// runtime/actions.ts
export type RuntimeAction =
  | CreateNodeAction
  | RemoveNodeAction
  | MoveNodeAction
  | UpdateLayoutAction
  | RotateNodeAction
  | UpdatePropsAction
  | UpdateStyleAction
  | UpdateBindingsAction
  | UpdateRuntimeAction
  | UpdateSelectionAction
  | BatchAction<RuntimeAction>;
```

Because `BatchAction<RuntimeAction>` is part of the union, `HandlerMap<RuntimeAction, ...>` has a key `"batch-actions"` that maps to `HandlerEntry<SceneGraph, BatchAction<RuntimeAction>, RuntimeContext>`. No `as unknown as` is needed — the batch handler receives a typed `BatchAction<RuntimeAction>` directly.

The same pattern applies for document actions:

```ts
// document/actions.ts
export interface BatchDocumentAction<TAction extends { type: string }> {
  type: "batch-document-actions";
  actions: TAction[];
}

export type DocumentAction =
  | CreatePageAction
  | RemovePageAction
  | ...
  | BatchDocumentAction<DocumentAction>;
```

## 4. ActionRegistry

`ActionRegistry` holds a single `HandlerMap` and provides lookup by action type. Because `HandlerMap` preserves per-action types, all getters are fully typed and never need casts:

```ts
// engine/handler-registry.ts
export class ActionRegistry<
  TState,
  TAction extends { type: string },
  TContext extends RuntimeContext,
> {
  private entries = {} as HandlerMap<TAction, TState, TContext>;

  register<TA extends TAction>(
    type: TA["type"],
    entry: HandlerEntry<TState, TA, TContext>,
  ): void {
    (this.entries as Record<string, unknown>)[type] = entry;
  }

  getHandler<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["handler"] | undefined {
    return (this.entries as Record<string, unknown>)[type]?.handler;
  }

  getInverse<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["inverse"] | undefined {
    return (this.entries as Record<string, unknown>)[type]?.inverse;
  }

  getEntry<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K] | undefined {
    return (this.entries as Record<string, unknown>)[type];
  }

  getMeta<K extends TAction["type"]>(
    type: K,
  ): ActionMeta | undefined {
    return (this.entries as Record<string, unknown>)[type]?.meta;
  }
}
```

The `register()` method uses a single cast on the internal object (`as Record<string, unknown>`), never at consumer call sites. Every `get*()` returns the exact type extracted from `HandlerMap`, so downstream code is fully typed:

```ts
const entry = registry.getEntry("create-node");
// entry: HandlerEntry<SceneGraph, CreateNodeAction, RuntimeContext> | undefined
```

### 4.1 Batch Entry

Since `BatchAction<TAction>` is now a proper member of the action union, the batch handler and inverse work with the typed `BatchAction<TAction>` directly. The `createBatchEntry` method generates the entry from the registry's own HandlerMap:

```ts
class ActionRegistry<TState, TAction extends { type: string }, TContext extends RuntimeContext> {
  createBatchEntry(): HandlerEntry<TState, BatchAction<TAction>, TContext> {
    const self = this;
    return {
      handler(state: TState, action: BatchAction<TAction>, context: TContext): TState {
        let current = state;
        for (const child of action.actions) {
          const entry = self.getEntry(child.type as TAction["type"]);
          if (!entry) return state;
          current = entry.handler(current, child as TAction, context);
        }
        return current;
      },
      inverse(stateBefore: TState, action: BatchAction<TAction>, context: TContext) {
        const inverses: TAction[] = [];
        let current = stateBefore;
        for (const child of action.actions) {
          const inv = self.getInverse(child.type as TAction["type"])
            ?.(current, child as TAction, context);
          if (inv) inverses.push(inv);
          const entry = self.getEntry(child.type as TAction["type"]);
          if (entry) current = entry.handler(current, child as TAction, context);
        }
        if (inverses.length === 0) return undefined;
        if (inverses.length === 1) return inverses[0];
        return { type: "batch-actions" as const, actions: inverses.reverse() };
      },
      validate(action: BatchAction<TAction>) {
        for (const child of action.actions) {
          const entry = self.getEntry(child.type as TAction["type"]);
          if (entry?.validate) {
            const result = entry.validate(child as TAction);
            if (!result.ok) return result;
          }
        }
        return { ok: true };
      },
      meta: { undoable: true, mergeable: true, devtoolsLabel: "Batch" },
    };
  }
}
```

Key improvements over the previous design:

1. No `as unknown as { actions: TAction[] }` — the parameter is already `BatchAction<TAction>`.
2. The batch entry itself carries a `validate` that delegates to each child's `validate`.
3. The `as TAction` casts at dispatch boundaries are the only type narrowing — they are safe because `BatchAction<TAction>` guarantees `action.actions` contains valid `TAction` members.

## 5. Registration

### 5.1 Registration Module

Each domain has one registration module that imports all handler entries, type-checks exhaustiveness against `HandlerMap`, and builds the registry:

```ts
// runtime/register-handlers.ts
import { ActionRegistry, type HandlerMap } from "../engine/handler-registry.js";
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
import type { RuntimeAction, BatchAction } from "./actions.js";
import type { SceneGraph, RuntimeContext } from "../types.js";

type NonBatch = Exclude<RuntimeAction, BatchAction<RuntimeAction>>;

const handlerMap: HandlerMap<NonBatch, SceneGraph, RuntimeContext> = {
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

export function createRuntimeRegistry(): ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext> {
  const registry = new ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>();

  for (const [type, entry] of Object.entries(handlerMap)) {
    registry.register(type, entry);
  }

  registry.register("batch-actions", registry.createBatchEntry());

  return registry;
}
```

### 5.2 Exhaustiveness

`HandlerMap<NonBatch, SceneGraph, RuntimeContext>` ensures at compile time that every non-batch `RuntimeAction["type"]` has a corresponding entry in `handlerMap`. Adding a new action type to `RuntimeAction` but not to `handlerMap` produces a TypeScript error.

Because `BatchAction<RuntimeAction>` is part of the union, its exclusion via `Exclude<RuntimeAction, BatchAction<RuntimeAction>>` is necessary. The batch entry is registered separately by the factory method. If the batch entry registration line were removed, compilation would still succeed but batch actions would silently be unhandled — a runtime guard in the dispatch path catches this.

### 5.3 Document Domain Mirror

```ts
// document/register-handlers.ts
import { ActionRegistry, type HandlerMap } from "../engine/handler-registry.js";
// ... import all document handler entries
import type { DocumentAction, BatchDocumentAction } from "./actions.js";
import type { VisualDocument, DocumentRuntimeContext } from "../types.js";

type NonBatchDoc = Exclude<DocumentAction, BatchDocumentAction<DocumentAction>>;

const handlerMap: HandlerMap<NonBatchDoc, VisualDocument, DocumentRuntimeContext> = {
  "create-page": createPage,
  "remove-page": removePage,
  "rename-page": renamePage,
  "reorder-page": reorderPage,
  "update-page-route": updatePageRoute,
  "set-document-theme": setDocumentTheme,
  "set-page-theme": setPageTheme,
};

export function createDocumentRegistry(): ActionRegistry<DocumentAction, VisualDocument, DocumentRuntimeContext> {
  const registry = new ActionRegistry<DocumentAction, VisualDocument, DocumentRuntimeContext>();
  for (const [type, entry] of Object.entries(handlerMap)) registry.register(type, entry);
  registry.register("batch-document-actions", registry.createBatchEntry());
  return registry;
}
```

### 5.4 Backward Compatibility

Engine components that consume the old two-map form (`HandlerRegistry` + `InverseRegistry`) can be adapted via a `splitRegistry` helper:

```ts
export function splitRegistry<TAction extends { type: string }, TState, TContext extends RuntimeContext>(
  registry: ActionRegistry<TAction, TState, TContext>,
): {
  handlerRegistry: HandlerRegistry<TState, TAction, TContext>;
  inverseRegistry: InverseRegistry<TAction>;
} {
  const entries: [string, HandlerEntry<TState, TAction, TContext>][] = [];
  // iterate internal map and convert
  return buildRegistriesFromEntries(entries);
}
```

## 6. Consumption

### 6.1 Command Bus

The command bus receives the `ActionRegistry` and dispatches by action type:

```ts
// engine/command-bus.ts
export interface CommandBusConfig<TAction extends { type: string }, TState, TContext extends RuntimeContext> {
  registry: ActionRegistry<TAction, TState, TContext>;
  validate: boolean;
}

export function createCommandBus<TAction extends { type: string }, TState, TContext extends RuntimeContext>(
  config: CommandBusConfig<TAction, TState, TContext>,
) {
  function dispatch(action: TAction, state: TState, context: TContext): DispatchResult<TState> {
    if (config.validate) {
      const meta = config.registry.getMeta(action.type);
      // ... check meta.undoable, mergeable, etc.
    }
    const handler = config.registry.getHandler(action.type);
    if (!handler) return { ok: false, error: { code: "handler-not-found", message: `No handler for ${action.type}` } };
    return { ok: true, state: handler(state, action, context) };
  }

  return { dispatch };
}
```

### 6.2 Transaction Manager

The transaction manager uses the registry for both forward dispatch and inverse computation:

```ts
// engine/transaction-manager.ts
export interface TransactionManagerConfig<TAction extends { type: string }, TState, TContext extends RuntimeContext> {
  registry: ActionRegistry<TAction, TState, TContext>;
}

export function createTransactionManager<TAction extends { type: string }, TState, TContext extends RuntimeContext>(
  config: TransactionManagerConfig<TAction, TState, TContext>,
) {
  function execute(action: TAction, state: TState, context: TContext): { state: TState; inverse?: TAction } {
    const inverse = config.registry.getInverse(action.type)?.(state, action, context);
    const handler = config.registry.getHandler(action.type);
    if (!handler) throw new Error(`No handler for ${action.type}`);
    return { state: handler(state, action, context), inverse };
  }

  return { execute };
}
```

## 7. Adding a New Action

Adding a new action type requires exactly these files:

| File | Change |
|------|--------|
| `actions.ts` | Add the action schema and type to the union |
| `handlers/create-foo.ts` | New file: export the `HandlerEntry` object |
| `register-handlers.ts` | Import the new entry and add it to `handlerMap` |
| `runtime-engine.md` (or `document-runtime.md`) | Document the action behavior |

The `HandlerMap` type catches missing registration at compile time.

## 8. Cross-Handler Dependencies

Handler files must not import from other handler files. Shared utilities must live in a separate utility module:

```
handlers/
  update-page-route.ts   imports normalizeRoute from ../normalize-route.js
  create-page.ts         imports normalizeRoute from ../normalize-route.js
  normalize-route.ts     exports normalizeRoute (pure utility, no handler/inverse)
```

This keeps the dependency graph acyclic at the handler layer and allows any handler to be tested in isolation.

## 9. Summary

| Concept | Mechanism | Benefit |
|---------|-----------|---------|
| Co-location | `HandlerEntry` in one file | Handler + inverse + validate lifecycle bound |
| Typed registry | `HandlerMap<TAction, TState, TContext>` | No casts, exact return types |
| Batch | `BatchAction<TAction>` in union | Zero `as unknown`, self-recursive |
| Exhaustiveness | `HandlerMap<NonBatch, ...>` on `handlerMap` | Missing registration = compile error |
| Plugin support | `registry.register(type, entry)` | External code can add handlers |
| Introspection | `getMeta(type)` | Command bus, devtools, history all read from single source |
