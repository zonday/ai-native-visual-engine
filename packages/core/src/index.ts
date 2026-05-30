// ── Bootstrap ──
export { createNewDocument } from "./bootstrap.js";
// ── Compiler ──
export { compileSemanticAction } from "./compiler/pipeline.js";
export type { AiSchemaIndexSnapshot } from "./compiler/schema-index.js";
export type { CompileResult, SemanticAction } from "./compiler/types.js";
export {
  AutoLayoutActionSchema,
  CreateDashboardActionSchema,
  InsertChartActionSchema,
  UpdateThemeIntentActionSchema,
} from "./compiler/types.js";
// ── Component states ──
export { resolveStateProps } from "./component-states.js";
// ── Computed State ──
export {
  type ComputedStateEngine,
  createComputedStateEngine,
} from "./computed/computed-state-engine.js";
export { createConstraintMiddleware } from "./constraints/constraint-middleware.js";
export { createConstraintRegistry } from "./constraints/constraint-registry.js";
export { validateGraphInvariants } from "./constraints/graph-invariants.js";
export { DEFAULT_LAYOUT_CONSTRAINTS } from "./constraints/layout-constraints.js";
export { createDocumentCommandBus } from "./document/document-command-bus.js";
// ── Document ──
export type { DocumentAction } from "./document/register-handlers.js";
export {
  createDocumentRegistry,
  DocumentActionSchema,
} from "./document/register-handlers.js";
// ── Engine ──
export {
  type ActionMeta,
  ActionRegistry,
  type HandlerMap,
} from "./engine/action-registry.js";
export type { RuntimeContext } from "./engine/handler.js";
export type {
  BatchAction,
  HandlerEntry,
  InverseComputer,
} from "./engine/handler-registry.js";
// ── History ──
export {
  createHistoryState,
  type HistoryState,
  redoAction,
  setCheckpoint,
  undoAction,
} from "./engine/history.js";
// ── Middleware ──
export { createUndoHistoryMiddleware } from "./engine/history-middleware.js";
export { createTransactionMiddleware } from "./engine/middleware/transaction.js";
export { createValidatorMiddleware } from "./engine/middleware/validator.js";
export { createTransactionFlag } from "./engine/transaction-flag.js";
// ── Immer Patch Routing ──
export { routeImmerPatches } from "./immer-patch-router.js";
// ── Interaction ──
export {
  createInteractionEngine,
  type InteractionEngine,
} from "./interaction/interaction-engine.js";
// ── Plugin system ──
export type { ComponentPlugin } from "./plugin-types.js";
export { resolveInstance } from "./prototype.js";
// ── Rich text ──
export type { DocNode } from "./rich-text.js";
export { extractPlainText } from "./rich-text.js";
// ── Runtime ──
export type { RuntimeAction } from "./runtime/register-handlers.js";
export {
  createRuntimeRegistry,
  RuntimeActionSchema,
} from "./runtime/register-handlers.js";
export { createRuntimeCommandBus } from "./runtime/runtime-command-bus.js";
export { createRuntimeTransactionManager } from "./runtime/transaction.js";
// ── Scheduler ──
export { createScheduler, type Scheduler } from "./scheduler.js";
// ── Selector ──
export {
  createSelectorRegistry,
  type NodeField,
  type ScenePatch,
  type SelectorRegistry,
} from "./selector/selector-registry.js";
// ── Session ──
export { openDocumentSession } from "./session.js";
// ── Core types ──
export type {
  NodeId,
  PageId,
  PrototypeComponent,
  SceneGraph,
  SceneNode,
  SelectionState,
  ViewportState,
  VisualDocument,
} from "./types.js";
