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
// ── Computed Store ──
export {
  type ComputedStore,
  createComputedStore,
} from "./computed-store.js";
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
export { ActionRegistry } from "./engine/action-registry.js";
export type {
  CommandResult,
  HistoryService,
  TransactionService,
} from "./engine/factory.js";
export {
  createEngine,
  type Engine,
} from "./engine/factory.js";
export type { RuntimeContext } from "./engine/handler.js";
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
export { createValidatorMiddleware } from "./engine/middleware/validator.js";
export {
  createTransactionFlag,
  createTransactionMiddleware,
} from "./engine/transaction.js";
export { type EngineEvents, EventBus } from "./event-bus.js";
// ── Interaction ──
export {
  createInteractionEngine,
  type InteractionEngine,
} from "./interaction-engine.js";
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
// ── SceneStore ──
export {
  createSceneStore,
  type SceneStore,
} from "./scene-store.js";
// ── Scheduler ──
export { createScheduler, type Scheduler } from "./scheduler.js";
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
