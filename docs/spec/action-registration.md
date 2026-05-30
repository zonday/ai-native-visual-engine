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
| Immutable       | Never mutate the input `state` — produce a new state or use Immer `produce()` |

All side effects (telemetry, persistence, rendering, event dispatch) belong in the engine layer (command bus middleware, transaction hooks) — never inside a handler.

A handler that violates these invariants will cause double-execution bugs during batch inverse computation and incorrect behavior during transaction replay / undo.

### 2.1 Structural sharing via Immer

Handlers SHOULD use Immer's `produce()` instead of manual spreads to enforce immutability and gain structural sharing:

```ts
import { produce } from "immer";

// ❌ Manual spread — error-prone, no structural sharing
handler(scene, action, ctx) {
  return {
    ...scene,
    nodes: {
      ...scene.nodes,
      [action.node.id]: { ...action.node, parentId: action.parentId },
    },
  };
}

// ✅ Immer produce — automatic structural sharing, auto-freeze, no copy bugs
handler(scene, action, ctx) {
  return produce(scene, (draft) => {
    draft.nodes[action.node.id] = { ...action.node, parentId: action.parentId };
  });
}
```

Using `produce()` provides:

| Benefit | Explanation |
|---------|-------------|
| Structural sharing | Unchanged branches share memory references. Without it, each `{ ...scene }` spread copies the entire tree, making undo stacks and batch snapshots unaffordable at scale. |
| Auto-freeze (dev) | Immer `setAutoFreeze(true)` deep-freezes the result in development. Any external code that tries to mutate the returned state throws immediately. |
| No copy bugs | Writing to `draft` is mutation-safe — Immer tracks changes internally and produces the minimal immutable output. Shallow copy mistakes (`draft = x` instead of `draft.foo = x`) are caught at compile time. |
| Patch capture | `produceWithPatches` returns `[nextState, patches, inversePatches]`, enabling a future migration to patch-based undo/redo (§12). |

The handler signature remains `(state, action, context) => TState`. Immer is an implementation detail inside the handler body.

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
```

```ts
// engine/types.ts
export type Handler<TState, TAction, TContext> = (
  state: Readonly<TState>,
  action: TAction,
  context: TContext,
) => TState;

export type InverseComputer<TState, TAction, TContext extends RuntimeContext> = (
  stateBefore: Readonly<TState>,
  action: TAction,
  context: TContext,
) => TAction | undefined;
```

`InverseComputer` returns `TAction | undefined`. Because inverses often produce a different action type than they consume (e.g. `create-node` → `remove-node`), the domain-specific `HandlerEntry` types widen the return type to the full action union. The engine's generic `InverseComputer` is the base type; domain layers override the return type with their wider union.

`Readonly<TState>` is a compile-time hint, not a correctness guarantee — it prevents reassignment (e.g. `state.nodes = {}`) but not nested mutation (e.g. `state.nodes[id].x = 5`). Runtime enforcement comes from Immer's `autoFreeze` (§2.1), which deep-freezes the returned state in development. Handlers that use `produce()` are automatically safe; handlers that use manual spreads rely on the purity contract.

Each action type has exactly one module file that exports its `HandlerEntry`.

### 3.1 `undoable` and the inverse

`meta.undoable` is a policy flag, not a capability flag. If `undoable === false`, the history layer ignores the inverse even if one exists. This is useful for transient actions (selection, viewport) where computing an inverse is possible but recording it is wasteful.

The inverse function MUST still exist and be correct — it is used for batch rollback regardless of `undoable`.

### 3.2 Validator

Validation receives the full execution context, not just the action payload. This enables semantic validation (node existence, cyclic graphs, constraint checks). The type is defined in §3; `state` is `Readonly<TState>`:

```ts
// engine/types.ts (same contract as handler)
export type Validator<TState, TAction, TContext> = (
  state: Readonly<TState>,
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

Handlers communicate business-logic failures by throwing `HandlerError`. The engine catches these and converts them to `DispatchResult`:

```ts
export type DispatchResult<TState> =
  | { ok: true; state: TState }
  | { ok: false; error: { code: string; message: string; actionType: string } };
```

A handler that encounters a recoverable business error (e.g. duplicate ID, missing parent, nonexistent node) throws `HandlerError`. The engine wraps execution in a try/catch — a thrown `HandlerError` is caught and converted to `{ ok: false, ... }`. Any non-`HandlerError` throw is treated as an invariant violation and propagates uncaught.

Handlers NEVER return error values. The `TState` return type is always a valid state. All business errors flow through `HandlerError`.

This unified error model allows:
- Batch to detect partial failures and roll back atomically
- Transaction manager to produce correct `DispatchResult` for each action
- DevTools to trace all outcomes through a single type

### 3.4 Handler file convention

```
handlers/
  create-node.ts     → export const createNodeEntry
  remove-node.ts     → export const removeNodeEntry
  move-node.ts       → export const moveNodeEntry
  ...
```

Each file exports a single entry object that bundles handler, inverse, and metadata. Handler and inverse use specific action types; the registration module (§7) uses explicit `as` casts to widen to the full union (required by TypeScript's contravariance):

```ts
// handlers/create-node.ts
import { produce } from "immer";
import type { SceneGraph } from "../../types.js";
import type { CreateNodeAction, RuntimeAction } from "../actions.js";
import type { RuntimeContext } from "../handler-registry.js";
import { HandlerError } from "../../engine/error.js";

const createNodeHandler = (
  scene: SceneGraph,
  action: CreateNodeAction,
  _ctx: RuntimeContext,
): SceneGraph => {
  return produce(scene, (draft) => {
    if (draft.nodes[action.node.id]) {
      throw new HandlerError(
        "scene.duplicate-node-id",
        `Node ID "${action.node.id}" already exists`,
        "create-node",
        { nodeId: action.node.id },
      );
    }
    const parentId = draft.nodes[action.parentId] ? action.parentId : "root";
    draft.nodes[action.node.id] = { ...action.node, parentId };
    draft.nodes[parentId].children.push(action.node.id);
  });
};

const createNodeInverse = (
  _sceneBefore: SceneGraph,
  action: CreateNodeAction,
  _context: RuntimeContext,
): RuntimeAction => {
  return { type: "remove-node" as const, nodeId: action.node.id };
};

export const createNodeEntry = {
  handler: createNodeHandler,
  inverse: createNodeInverse,
  meta: { undoable: true, mergeable: false, devtoolsLabel: "Create Node" },
};
```

The handler function receives the specific `CreateNodeAction` type, giving full access to the action's fields without type narrowing. The inverse explicitly annotates its return type as `RuntimeAction` (the full union), which is correct because `create-node`'s inverse produces `remove-node` — a different type within the same union.

```ts
export const createNodeValidate = (
  scene: SceneGraph,
  action: CreateNodeAction,
  _ctx: RuntimeContext,
) => {
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
};

export const createNodeMeta = {
  undoable: true,
  mergeable: false,
  devtoolsLabel: "Create Node",
};
```

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
    if (this.entries.has(type)) {
      throw new Error(`Duplicate handler registration for action type "${type}"`);
    }
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

  has(type: TAction["type"]): boolean {
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
          if (!childHandler) {
            throw new Error(
              `Batch child action "${child.type}" has no registered handler`,
            );
          }
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

Each domain has one registration module that imports all handler entry objects, uses explicit `as` casts to handle contravariance, and builds the registry:

```ts
// runtime/register-handlers.ts
import { ActionRegistry } from "../engine/action-registry.js";
import { createNodeEntry } from "./handlers/create-node.js";
import { removeNodeEntry } from "./handlers/remove-node.js";
import { moveNodeEntry } from "./handlers/move-node.js";
import { updateLayoutEntry } from "./handlers/update-layout.js";
import { rotateNodeEntry } from "./handlers/rotate-node.js";
import { updatePropsEntry } from "./handlers/update-props.js";
import { updateStyleEntry } from "./handlers/update-style.js";
import { updateBindingsEntry } from "./handlers/update-bindings.js";
import { updateRuntimeEntry } from "./handlers/update-runtime.js";
import { updateSelectionEntry } from "./handlers/update-selection.js";
import type { RuntimeAction } from "./actions.js";
import type { RuntimeHandlerEntry } from "./handler-registry.js";

function entry(
  h: RuntimeHandlerEntry["handler"],
  i: RuntimeHandlerEntry["inverse"],
  m = { undoable: true, mergeable: false, devtoolsLabel: "" },
) {
  return { handler: h, inverse: i as any, meta: m };
}

export function createRuntimeRegistry(): ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext> {
  const registry = new ActionRegistry<RuntimeAction, SceneGraph, RuntimeContext>();
  registry.register("create-node", entry(
    createNodeEntry.handler as RuntimeHandlerEntry["handler"],
    createNodeEntry.inverse as RuntimeHandlerEntry["inverse"],
    createNodeEntry.meta,
  ));
  registry.register("remove-node", entry(
    removeNodeEntry.handler as RuntimeHandlerEntry["handler"],
    removeNodeEntry.inverse as RuntimeHandlerEntry["inverse"],
    removeNodeEntry.meta,
  ));
  // ... remaining actions ...
  registry.register("batch-actions", registry.createBatchEntry());
  return registry;
}
```

The `as ` casts are required because each handler is typed with a specific action (e.g. `CreateNodeAction`) but the registry stores a heterogeneous map keyed by the full `RuntimeAction` union. TypeScript's contravariance prevents the direct assignment — the casts are safe because each entry is only invoked with its matching action type via the registry's discriminated key lookup.

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

Implementation: the transaction manager captures an immutable structural reference to the state before the batch begins — this is a shared pointer (O(1)), not a deep clone. With Immer structural sharing (§2.1), the reference remains valid even as intermediate states are produced. On failure, the manager discards the intermediate state and restores the snapshot. The caller receives a single `DispatchResult` with `ok: false` and the error from child 3.

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
    // `action` is iterated from BatchAction<TAction>.actions (TAction[]).
    // TAction is a discriminated union — TS cannot narrow array elements by
    // a shared discriminant. The `action.type as TAction["type"]` and
    // `action as TAction` casts are safe because the batch guarantees every
    // child is a valid TAction member.
    const inv = registry.getInverse(action.type as TAction["type"]);
    if (inv) {
      const result = inv(stateBefore, action as TAction, context);
      if (result) {
        // Flatten nested batch actions to prevent BatchAction<BatchAction<...>> nesting.
        // `result` is `InverseAction<TAction>` — after narrowing on `type === "batch-actions"`,
        // TypeScript infers `result` as `BatchAction<TAction>` without a cast.
        if (result.type === "batch-actions") {
          inverses.push(...result.actions);
        } else {
          inverses.push(result);
        }
      }
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
    // Handlers that use Immer `produce()` are safe by construction — `produce`
    // never mutates the base state. Handlers using manual spreads rely on the
    // purity contract (§2). `Readonly<TState>` catches reassignment at compile
    // time but does not prevent nested mutation.
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

| Concern | Status / Future Direction |
|---------|--------------------------|
| Action versioning | Add `version` field to action schema; migration layer for persisted undo stacks and network sync |
| Patch-based history | Replace eager `inverse` with Immer patches or CRDT ops for efficient memory and OT/CRDT convergence |
| Plugin action augmentation | Replace closed union with `RuntimeActionMap` interface augmentation pattern |
| Inverse type narrowing | `type InverseOf<T>` mapped type for deterministic action→inverse type relationships |
| Validation/execution divergence | Validation dry-run and actual execution are separate passes. If a handler has a bug, the two can diverge. Future direction: unified `prepare → PreparedAction → apply` pipeline (see ProseMirror, Slate transforms) |
| **Structural sharing** | **Not a future optimization — a scalability prerequisite.** The architecture assumes immutable structural sharing. Current plain-object spreads are sufficient for small scenes, but production-scale scenes require persistent data structures or Immer-style structural sharing. Without it: undo stack explodes, batch snapshots are unaffordable, and validation dry-runs duplicate memory. |

None of these affect the current registration architecture. The `HandlerEntry` / `ActionRegistry` / `HandlerMap` design accommodates all future directions without breaking changes.

---

## 13. Summary

| Concept | Mechanism | Benefit |
|---------|-----------|---------|
| Co-location | `createNodeEntry` object per file | Handler + inverse + meta lifecycle bound |
| Typed registry | `HandlerMap<TAction, TState, TContext>` | Zero casts, exact return types |
| Structural sharing | `produce()` inside handlers (planned) | undo stack unaffordable without it |
| Immutability guard | `Readonly<TState>` + Immer auto-freeze | Compile-time + runtime mutation prevention |
| Typed inverse | Domain `InverseComputer` returns full union | `as` cast only at registration boundary |
| Batch in union | `BatchAction<TAction>` in action union | No `as unknown`, self-recursive |
| Atomic batch | Transaction manager records snapshot | No partial application observable |
| No handler replay | Per-child `stateBefore` recorded during execution | Never re-executes handlers for inverse |
| Unified error model | HandlerError normalized into DispatchResult | Single error path for batch, history, devtools |
| Handler purity | Immer produce + purity contract | Safe double-execution for validation + inverse |
| Acyclic graph | biome `noRestrictedImports` with `"./**"` | Blocks handler→handler imports at lint time |
| Closed-world | Explicit design decision | Predictable engine ABI |
