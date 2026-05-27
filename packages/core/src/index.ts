// ── Bootstrap ──
export {
  createEmptyScene,
  createNewDocument,
  generateId,
} from "./bootstrap.js";

// ── Compiler ──
export { compileSemanticAction } from "./compiler/pipeline.js";
export type { AiSchemaIndexSnapshot } from "./compiler/schema-index.js";
export type {
  CompileResult,
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
export { createRuntimeCommandBus } from "./runtime/runtime-command-bus.js";
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
