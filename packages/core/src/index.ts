// ── Bootstrap ──
export {
  createEmptyScene,
  createNewDocument,
  generateId,
} from "./bootstrap.js";
export {
  type ExecutePlanDeps,
  type ExecutePlanResult,
  executePlan,
} from "./compiler/executor.js";
// ── Compiler ──
export { compileSemanticAction } from "./compiler/pipeline.js";
export type { AiSchemaIndexSnapshot } from "./compiler/schema-index.js";
export type {
  CompileResult,
  ExecutionPlan,
  SemanticAction,
  SemanticDiagnostic,
} from "./compiler/types.js";
export {
  AutoLayoutActionSchema,
  CreateDashboardActionSchema,
  InsertChartActionSchema,
  SemanticActionSchema,
  UpdateThemeIntentActionSchema,
} from "./compiler/types.js";
// ── Component states ──
export { resolveStateProps } from "./component-states.js";
// ── Computed State ──
export {
  type ComputedBounds,
  type ComputedStateEngine,
  createComputedStateEngine,
  type WorldTransform,
} from "./computed/computed-state-engine.js";
export { createConstraintMiddleware } from "./constraints/constraint-middleware.js";
export { createConstraintRegistry } from "./constraints/constraint-registry.js";
export {
  type GraphInvariantViolation,
  validateGraphInvariants,
} from "./constraints/graph-invariants.js";
export { DEFAULT_LAYOUT_CONSTRAINTS } from "./constraints/layout-constraints.js";
// ── Data binding ──
export {
  cleanupBindings,
  reResolveOnSourceChange,
  resolveBinding,
  resolveBindings,
  subscribeBinding,
} from "./data/binding.js";
// ── Data interaction ──
export {
  type CrossFilterSubscription,
  createDataInteractionAPI,
  type DataInteractionAPI,
  type DrillDimension,
  type DrillState,
  type DrillThroughTarget,
  type FilterChangeEvent,
  type SelectionEvent,
} from "./data/interaction.js";
export type { FilterParam } from "./data/types.js";
export {
  type DataSourceRegistry,
  type Dataset,
  InMemoryDataSourceRegistry,
  type ResolvedBinding,
} from "./data/types.js";
export type { DocumentAction } from "./document/actions.js";
// ── Document ──
export { DocumentActionSchema } from "./document/actions.js";
export { createDocumentCommandBus } from "./document/document-command-bus.js";
export { createBatchHandler as createDocumentBatchHandler } from "./document/handlers/batch.js";
export {
  createDocumentHistoryState,
  type DocumentHistoryState,
  pushDocumentUndoTransaction,
  redoDocumentAction,
  undoDocumentAction,
} from "./document/history.js";
export { createDefaultDocumentRegistries } from "./document/inverse.js";
export {
  createDocumentTransactionManager,
  type DocumentTransactionManager,
} from "./document/transaction.js";
export { pushUndoTransaction } from "./engine/history.js";
// ── Middleware ──
export { createUndoHistoryMiddleware } from "./engine/history-middleware.js";
export { createTransactionMiddleware } from "./engine/middleware/transaction.js";
export { createValidatorMiddleware } from "./engine/middleware/validator.js";
export {
  createTransactionFlag,
  type TransactionFlag,
} from "./engine/transaction-flag.js";
// ── Transaction ──
export {
  type ActiveTransaction,
  type DispatchResult,
  TransactionManager,
} from "./engine/transaction-manager.js";
export type {
  RuntimeTransaction,
  TransactionContext,
  TransactionResult,
  TransactionSource,
} from "./engine/transaction-types.js";
// ── Interaction ──
export {
  createInteractionEngine,
  type InteractionEngine,
  type InteractionEvent,
  type InteractionListener,
} from "./interaction/interaction-engine.js";
// ── Plugin system ──
export type { ComponentPlugin } from "./plugin-types.js";
export type { ResolvedInstance } from "./prototype.js";
export {
  createNodeFromPrototype,
  detachInstance,
  resolveInstance,
} from "./prototype.js";
// ── Rich text ──
export type { DocNode } from "./rich-text.js";
export { extractPlainText } from "./rich-text.js";
// ── Runtime ──
export type { RuntimeAction } from "./runtime/actions.js";
export { RuntimeActionSchema } from "./runtime/actions.js";
export { createBatchHandler } from "./runtime/handlers/batch.js";
export {
  createRuntimeHistoryState,
  pushRuntimeUndoTransaction,
  redoRuntimeAction,
  undoRuntimeAction,
} from "./runtime/history.js";
export { createDefaultRuntimeRegistries } from "./runtime/inverse.js";
export { createRuntimeCommandBus } from "./runtime/runtime-command-bus.js";
export {
  adaptRuntimeDispatch,
  createRuntimeTransactionManager,
  type RuntimeTransactionManager,
} from "./runtime/transaction.js";
// ── Scheduler ──
export {
  createScheduler,
  type ScheduleListener,
  type SchedulePhase,
  type Scheduler,
} from "./scheduler/scheduler.js";
// ── Selector ──
export {
  createSelectorRegistry,
  type SelectorRegistry,
} from "./selector/selector-registry.js";
// ── Serialization ──
export {
  CURRENT_SERIALIZATION_VERSION,
  serializeDocument,
} from "./serialization.js";
// ── Session ──
export type {
  DocumentSession,
  EditorSessionState,
} from "./session.js";
export {
  loadDocument,
  materializeScene,
  openDocumentFromSnapshot,
  openDocumentSession,
} from "./session.js";
// ── Theme ──
export { BASE_THEME, resolveTheme } from "./theme.js";
// ── Prototype components ──
// ── Core types ──
export type {
  Binding,
  DocumentId,
  DocumentSnapshot,
  NodeId,
  Page,
  PageId,
  PrototypeComponent,
  SceneGraph,
  SceneNode,
  SelectionState,
  Variable,
  ViewportState,
  VisualDocument,
} from "./types.js";

// ── Core schemas ──
export {
  DocumentSnapshotSchema,
  SceneGraphSchema,
  SceneNodeSchema,
  VisualDocumentSchema,
} from "./types.js";
