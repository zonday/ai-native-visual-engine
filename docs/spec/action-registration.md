# Action Registration

## 1. Scope

This document defines how action handlers, inverse computers, validators, and metadata are defined, registered, and discovered by the command bus and transaction manager.

Both scene runtime actions (`RuntimeAction`) and document actions (`DocumentAction`) follow the same pattern. The engine layer provides generic type infrastructure; domain-specific layers (runtime, document) specialize with their own action union and state type.

---

## 2. Handler Contract

Every handler function MUST obey these invariants. Violations produce undefined behavior at the engine level.

| Invariant       | Rule |
|-----------------|------|
| Pure            | Same input always produces same output |
| Deterministic   | No reliance on `Math.random()`, `Date.now()`, external state |
| Synchronous     | No `async`, no `Promise`, no callbacks |
| Side-effect free| No analytics, no logging, no persistence, no event emission |

All side effects (telemetry, persistence, rendering, event dispatch) belong in the engine layer (command bus middleware, transaction hooks) — never inside a handler.

A handler that violates these invariants will cause double-execution bugs during batch inverse computation and incorrect behavior during transaction replay / undo.

---

## 3. Handler Entry

Every action handler, its inverse, its validation rule, and its metadata are co-located in a single `HandlerEntry` value:

```ts
// engine/types.ts
export interface ActionMeta {
  undoable: boolean;
  mergeable: boolean;
  historyGroup?: string;
  devtoolsLabel?: string;
}

export interface HandlerEntry<TState, TAction, TContext extends RuntimeContext> {
  handler: Handler<TState, TAction, TContext>;
  inverse: InverseComputer<TState, TAction, TContext>;
  validate: Validator<TState, TAction, TContext>;
  meta: ActionMeta;
}

The `state` parameter of every handler, inverse, and validator is typed `Readonly<TState>` to prevent direct mutation at the type level:

```ts
// engine/types.ts
export type Handler<TState, TAction, TContext> = (
  state: Readonly<TState>,
  action: TAction,
  context: TContext,
) => TState;

export type InverseComputer<TState, TAction, TContext> = (
  stateBefore: Readonly<TState>,
  action: TAction,
  context: TContext,
) => TAction | undefined;

export type Validator<TState, TAction, TContext> = (
  state: Readonly<TState>,
  action: TAction,
  context: TContext,
) => ValidationResult;
```

`Readonly<TState>` is a shallow constraint — it prevents property reassignment (e.g. `state.nodes = {}`) but not nested mutation (e.g. `state.nodes[id].x = 5`). The shallow constraint catches the most common mutation pattern at compile time. Deep immutability would require runtime enforcement (e.g. `Object.freeze` or Immer `freeze`) and is reserved for a future optimization pass.

For batch inverse computation, the return type is generalized to allow both single actions and batch containers:

```ts
export type InverseAction<TAction extends { type: string }> =
  TAction | BatchAction<TAction>;
```

Each action type has exactly one module file that exports its `HandlerEntry`.

### 3.1 `undoable` and the inverse

`meta.undoable` is a policy flag, not a capability flag. If `undoable === false`, the history layer ignores the inverse even if one exists. This is useful for transient actions (selection, viewport) where computing an inverse is possible but recording it is wasteful.

The inverse function MUST still exist and be correct — it is used for batch rollback regardless of `undoable`.

### 3.2 Validator

Validation receives the full execution context, not just the action payload. This enables semantic validation (node existence, cyclic graphs, constraint checks):

```ts
// engine/types.ts
export type Validator<TState, TAction, TContext> = (
  state: TState,
  action: TAction,
  context: TContext,
) => ValidationResult;

export interface ValidationResult {
  ok: boolean;
  error?: { code: string; message: string };
}
```

A validator MUST be pure, deterministic, and side-effect free (same contract as `handler`).

### 3.3 Error model

Handlers MUST NOT throw for business-logic errors. The only valid reasons to throw are TypeScript invariant violations (e.g. a handler that genuinely cannot produce a valid return).

All business-logic errors are communicated through the `HandlerResult` return type:

```ts
export type DispatchResult<TState> =
  | { ok: true; state: TState }
  | { ok: false; error: { code: string; message: string; actionType: string } };
```

The `handler` function returns a new state. The engine calls `handler` inside a try/catch — a thrown `HandlerError` is caught and converted to a `DispatchResult` with `ok: false`. A non-`HandlerError` throw is treated as an invariant violation and propagates uncaught.

This unified error model allows:
- Batch to detect partial failures and roll back atomically
- Transaction manager to produce correct `DispatchResult` for each action
- DevTools to trace all outcomes through a single type

### 3.4 Handler file convention

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
    const children = [...(scene.nodes[parentId]?.children ?? []), node.id];
    const parent = { ...scene.nodes[parentId], children };
    return {
      ...scene,
      nodes: { ...scene.nodes, [node.id]: node, [parentId]: parent },
    };
  },

  inverse(_sceneBefore: SceneGraph, action: CreateNodeAction, _ctx: RuntimeContext) {
    return { type: "remove-node" as const, nodeId: action.node.id };
  },

  validate(scene: SceneGraph, action: CreateNodeAction, _ctx: RuntimeContext) {
    if (!action.node.id) {
      return { ok: false, error: { code: "missing-id", message: "Node ID is required" } };
    }
    if (scene.nodes[action.node.id]) {
      return { ok: false, error: { code: "duplicate-id", message: `Node "${action.node.id}" already exists` } };
    }
    if (action.parentId !== "root" && !scene.nodes[action.parentId]) {
      return { ok: false, error: { code: "invalid-parent", message: `Parent "${action.parentId}" not found` } };
    }
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
5. `meta` is required. Every action declares `undoable` and `mergeable`.

---

## 4. Action Union

The action union is **compile-time closed**. This is an explicit design decision:

- New action types require modifying the union
- Plugins register via `registry.register(type, entry)` but can only add handlers for types already in the union
- This prevents unknown action types from entering the system and keeps the type exhaustiveness check sound

If full plugin extensibility is needed in the future, the union can be replaced with a type-augmentation pattern:

```ts
// Future option: augmentation-based plugin types
export interface RuntimeActionMap {
  "create-node": CreateNodeAction;
}
export type RuntimeAction = RuntimeActionMap[keyof RuntimeActionMap];
```

For now, the closed union is the right choice: actions are part of the engine ABI.

### 4.1 Batch Action

Batch is a generic action type — a container that can hold any `TAction`:

```ts
// engine/types.ts
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

Because `BatchAction<RuntimeAction>` is part of the union, `HandlerMap` has a key `"batch-actions"` whose handler receives a typed `BatchAction<RuntimeAction>` — no `as unknown as` needed.

---

## 5. HandlerMap

A typed record that preserves exact per-action types at the type level:

```ts
// engine/types.ts
export type HandlerMap<
  TAction extends { type: string },
  TState,
  TContext extends RuntimeContext,
> = {
  [K in TAction["type"]]: HandlerEntry<
    TState,
    Extract<TAction, { type: K }>,
    TContext
  >;
};
```

Indexing with a literal key returns the exact entry type:

```ts
type Map = HandlerMap<RuntimeAction, SceneGraph, RuntimeContext>;
// Map["create-node"] → HandlerEntry<SceneGraph, CreateNodeAction, RuntimeContext>
// Map["remove-node"] → HandlerEntry<SceneGraph, RemoveNodeAction, RuntimeContext>
```

---

## 6. ActionRegistry

The registry is the single point of lookup for all action metadata. It holds a `HandlerMap` internally as a `Map` (safe from prototype pollution):

```ts
// engine/action-registry.ts
export class ActionRegistry<
  // TAction is always the full action union — placed first as the primary type.
  TAction extends { type: string },
  TState,
  TContext extends RuntimeContext,
> {
  private entries = new Map<string, unknown>();

  register<K extends TAction["type"]>(
    type: K,
    entry: HandlerMap<TAction, TState, TContext>[K],
  ): void {
    this.entries.set(type, entry);
  }

  getHandler<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["handler"] | undefined {
    return (this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K])?.handler;
  }

  getInverse<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["inverse"] | undefined {
    return (this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K])?.inverse;
  }

  getValidator<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K]["validate"] | undefined {
    return (this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K])?.validate;
  }

  getMeta<K extends TAction["type"]>(
    type: K,
  ): ActionMeta | undefined {
    return (this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K])?.meta;
  }

  getEntry<K extends TAction["type"]>(
    type: K,
  ): HandlerMap<TAction, TState, TContext>[K] | undefined {
    return this.entries.get(type) as HandlerMap<TAction, TState, TContext>[K] | undefined;
  }

  has(type: string): boolean {
    return this.entries.has(type);
  }
}
```

Every `get*()` returns the exact type extracted from `HandlerMap`. Downstream code is fully typed:

```ts
const entry = registry.getEntry("create-node");
// entry: HandlerEntry<SceneGraph, CreateNodeAction, RuntimeContext> | undefined

const handler = registry.getHandler("create-node");
// handler: ((scene: SceneGraph, action: CreateNodeAction, ctx: RuntimeContext) => SceneGraph) | undefined
```

The single cast (`as HandlerMap<...>[K]`) at each getter boundary is safe because `register()` guarantees the entry maps to the correct key.

### 6.1 Batch Entry Factory

Batch is the one action type whose handler and inverse depend on the registry itself. The factory reads the registry's internal entries to dispatch child actions:

```ts
class ActionRegistry<TAction extends { type: string }, TState, TContext extends RuntimeContext> {
  createBatchEntry(): HandlerEntry<TState, BatchAction<TAction>, TContext> {
    const self = this;

    return {
      handler(state: TState, action: BatchAction<TAction>, context: TContext): TState {
        let current = state;
        for (const child of action.actions) {
          const childHandler = self.getHandler(child.type as TAction["type"]);
          if (!childHandler) return state;
          current = childHandler(current, child as TAction, context);
        }
        return current;
      },

      // Inverse is NOT computed here. The transaction manager records
      // per-child before-states during forward execution and provides
      // them externally. This avoids double-executing handlers.
      inverse(_stateBefore: TState, _action: BatchAction<TAction>, _context: TContext) {
        // Unreachable — the transaction manager uses a specialized batch inverse path.
        // See §9.2 (Transaction Manager) for the actual batch inverse computation.
        throw new Error("Batch inverse must be computed by the transaction manager");
      },

      validate(state: TState, action: BatchAction<TAction>, context: TContext) {
        let current = state;
        for (const child of action.actions) {
          const childValidator = self.getValidator(child.type as TAction["type"]);
          if (childValidator) {
            const result = childValidator(current, child as TAction, context);
            if (!result.ok) return result;
          }
          const childHandler = self.getHandler(child.type as TAction["type"]);
          if (childHandler) current = childHandler(current, child as TAction, context);
        }
        return { ok: true };
      },

      meta: { undoable: true, mergeable: true, devtoolsLabel: "Batch" },
    };
  }
}
```

The `createBatchEntry` method returns a valid `HandlerEntry` for the batch action type. Its `inverse` throws intentionally — see §9.2 for how the transaction manager handles batch inverse computation.

---

## 7. Registration

### 7.1 Registration Module

Each domain has one registration module that imports all handler entries, type-checks exhaustiveness against `HandlerMap`, and builds the registry:

```ts
// runtime/register-handlers.ts
import { ActionRegistry, type HandlerMap, type BatchAction } from "../engine/action-registry.js";
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
    registry.register(type as keyof typeof handlerMap, entry);
  }

  registry.register("batch-actions", registry.createBatchEntry());

  return registry;
}
```

### 7.2 Exhaustiveness

`HandlerMap<NonBatch, SceneGraph, RuntimeContext>` ensures at compile time that every non-batch `RuntimeAction["type"]` has a corresponding entry in `handlerMap`. Adding a new action type to `RuntimeAction` but not to `handlerMap` produces a TypeScript error.

`BatchAction<RuntimeAction>` is excluded from the mapped type (via `Exclude`) because its entry is constructed by the factory. If the batch registration line is removed, a runtime guard in the dispatch path catches unhandled action types.

### 7.3 Closed-world acknowledgment

The registration module explicitly imports every handler. No dynamic registration occurs after engine initialization. This is by design — see §4 for rationale.

---

## 8. Command Bus and Transaction Manager

The two consumers of the registry have distinct responsibilities.

### 8.1 Command Bus

| Concern | Responsibility |
|---------|---------------|
| Dispatch | Lookup handler by action type, call it, return `DispatchResult` |
| Middleware | Pipeline around each dispatch (logging, metrics, telemetry) |
| Pre-validation | Run `validate(state, action, ctx)` before handler |
| Error wrapping | Catch `HandlerError`, convert to `{ ok: false, ... }` |
| Batching | Detect `BatchAction`, delegate to transaction manager |

The command bus does NOT compute inverses or manage history.

### 8.2 Transaction Manager

| Concern | Responsibility |
|---------|---------------|
| State evolution | Serial execution of one or more actions on a state |
| Inverse recording | Record `stateBefore` for each action iteration |
| History push | Push the `{ action, stateBefore, stateAfter, inverse }` record |
| Batch atomicity | Roll back to original state on any child failure |

The transaction manager uses the registry for handler and inverse lookup.

### 8.3 Transaction execution invariants

1. Before executing any action, the transaction manager records the current state snapshot.
2. After execution, the manager computes the inverse using the recorded snapshot — it NEVER re-executes the handler during inverse computation for non-batch actions.
3. For batch actions, the manager records a per-child state snapshot for each child action. The batch inverse is computed from these recorded snapshots, NOT from re-executing child handlers.

---

## 9. Batch Execution Semantics

### 9.1 Atomicity

Batches are atomic. If any child action fails:

```
Steps:
  child 1: ok
  child 2: ok
  child 3: FAIL
```

The entire batch is rolled back to the state before the batch started. Partial application is never observable.

Implementation: the transaction manager takes a snapshot of the state before the batch begins. On failure, it discards the intermediate state and restores the snapshot. The caller receives a single `DispatchResult` with `ok: false` and the error from child 3.

### 9.2 Inverse computation (no handler re-execution)

The transaction manager records per-child states during batch execution:

```ts
// Execution step recorded by the transaction manager for each child
interface BatchStep<TAction, TState> {
  action: TAction;
  stateBefore: TState;
}
```

When computing the batch inverse:

```ts
function computeBatchInverse<TAction extends { type: string }, TState, TContext extends RuntimeContext>(
  batchAction: BatchAction<TAction>,
  steps: BatchStep<TAction, TState>[],
  registry: ActionRegistry<TAction, TState, TContext>,
  context: TContext,
): InverseAction<TAction> | undefined {
  const inverses: InverseAction<TAction>[] = [];

  // Process actions in reverse order
  for (let i = steps.length - 1; i >= 0; i--) {
    const { action, stateBefore } = steps[i];
    const inv = registry.getInverse(action.type as TAction["type"]);
    if (inv) {
      const result: InverseAction<TAction> | undefined = inv(stateBefore, action as TAction, context);
      if (result) inverses.push(result);
    }
  }

  if (inverses.length === 0) return undefined;
  if (inverses.length === 1) return inverses[0];
  return { type: "batch-actions", actions: inverses } satisfies BatchAction<TAction>;
}
```

Key properties:
- Handlers are NEVER re-executed during inverse computation.
- Each child's inverse receives its correct `stateBefore` from the recorded steps.
- The inverse actions are reversed before wrapping in a new `BatchAction`.

### 9.3 Transactional validation

Batch validation is state-progressive:

```ts
function validateBatch<TAction extends { type: string }, TState, TContext extends RuntimeContext>(
  batchAction: BatchAction<TAction>,
  state: TState,
  context: TContext,
  registry: ActionRegistry<TAction, TState, TContext>,
): ValidationResult {
  let current = state;
  for (const child of batchAction.actions) {
    const validate = registry.getValidator(child.type as TAction["type"]);
    if (validate) {
      const result = validate(current, child as TAction, context);
      if (!result.ok) return result;
    }
    // Advance state for next validation — this is a dry run.
    // The handler MUST be pure (no mutation of `current`). The `Readonly<TState>`
    // constraint on the handler's first parameter catches direct reassignment
    // at compile time. If the handler violates purity, the original `state`
    // object is NOT affected because every handler returns a new object.
    const handler = registry.getHandler(child.type as TAction["type"]);
    if (handler) {
      current = handler(current, child as TAction, context);
    }
  }
  return { ok: true };
}
```

Note: this validation handler run is the ONLY handler execution during validation. It is a forward simulation, distinct from the double-execution problem in §9.2. The validation run is pure and side-effect free per the handler contract.

---

## 10. Adding a New Action

| File | Change |
|------|--------|
| `actions.ts` | Add the action schema and type to the union |
| `handlers/create-foo.ts` | New file: export the `HandlerEntry` object |
| `register-handlers.ts` | Import the new entry and add it to `handlerMap` |
| Domain spec doc | Document the action behavior |

The `HandlerMap` type catches missing registration at compile time.

---

## 11. Cross-Handler Dependencies

Handler files must not import from other handler files. Shared utilities live in a separate utility module:

```
handlers/
  update-page-route.ts   imports normalizeRoute from ../normalize-route.js
  create-page.ts         imports normalizeRoute from ../normalize-route.js
  normalize-route.ts     exports normalizeRoute (pure utility, no handler/inverse)
```

This keeps the dependency graph acyclic at the handler layer and allows any handler to be tested in isolation.

### 11.1 Biome Enforcement

The project's `biome.json` enforces this restriction automatically for all files under `packages/core/src/*/handlers/`:

```json
{
  "overrides": [
    {
      "includes": ["packages/core/src/runtime/handlers/**", "packages/core/src/document/handlers/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "patterns": [{
                  "group": ["./**"],
                  "message": "Handlers must not import from other handler files. Extract shared logic to a separate utility module outside the handlers/ directory."
                }]
              }
            }
          }
        }
      }
    }
  ]
}
```

The pattern `"./**"` matches any relative import that begins with `./` — all same-directory imports. Since `handlers/` contains only handler files, this effectively blocks all handler-to-handler imports while allowing cross-directory imports (e.g. `"../../engine/error"`, `"../types"`, `"../actions"`).

A pre-commit hook or CI step runs `pnpm exec biome check --staged` to catch violations before they reach the repository.

---

## 12. Future Considerations

These are tracked as architectural debt for later iterations, not blockers for the current design.

| Concern | Future Direction |
|---------|-----------------|
| Action versioning | Add `version` field to action schema; migration layer for persisted undo stacks and network sync |
| Patch-based history | Replace eager `inverse` with `Immer` patches or CRDT ops for efficient memory and OT/CRDT convergence |
| Plugin action augmentation | Replace closed union with `RuntimeActionMap` interface augmentation pattern |
| Inverse type narrowing | `type InverseOf<T>` mapped type for deterministic action→inverse type relationships |
| Structural sharing | Use immer-style `produce` or arena storage to avoid full-state spreads on large scenes |

None of these affect the current registration architecture. The `HandlerEntry` / `ActionRegistry` / `HandlerMap` design accommodates all future directions without breaking changes.

---

## 13. Summary

| Concept | Mechanism | Benefit |
|---------|-----------|---------|
| Co-location | `HandlerEntry` in one file | Handler + inverse + validate lifecycle bound |
| Typed registry | `HandlerMap<TAction, TState, TContext>` | Zero casts, exact return types |
| Readonly guard | `Readonly<TState>` on handler params | Compile-time mutation prevention |
| Typed batch inverse | `InverseAction<TAction>` return type | No `as TAction` cast on batch container |
| Batch in union | `BatchAction<TAction>` | No `as unknown`, self-recursive |
| Exhaustiveness | `HandlerMap<NonBatch, ...>` on `handlerMap` | Missing registration = compile error |
| Atomic batch | Transaction manager records snapshot | No partial application observable |
| No handler replay | Per-child `stateBefore` recorded during execution | Never re-executes handlers for inverse |
| Progressive validation | `validate(state, action, ctx)` | Semantic checks (existence, cycles, constraints) |
| Unified error model | Handler never throws business errors | Predictable error handling at every layer |
| Handler purity | `Readonly<TState>` enforced by contract | Safe double-execution for validation + inverse |
| Acyclic graph | biome `noRestrictedImports` with `"./**"` | Blocks handler→handler imports at lint time |
| Closed-world | Explicit design decision | Sound exhaustiveness, predictable engine ABI |
