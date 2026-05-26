// ── Document actions ──

export type { NewDocumentOptions } from "./bootstrap.js";
// ── Bootstrap and lifecycle ──
export {
  createEmptyScene,
  createNewDocument,
  generateId,
} from "./bootstrap.js";
export { compileSemanticAction } from "./compiler/pipeline.js";
// ── AI Schema Index ──
export type {
  AiComponentEntry,
  AiPropEntry,
  AiSchemaIndex,
  AiSchemaIndexSnapshot,
} from "./compiler/schema-index.js";
export {
  buildSchemaIndex,
  schemaIndexToSnapshot,
} from "./compiler/schema-index.js";
// ── Compiler / Semantic Actions ──
export type {
  CompileFailure,
  CompileResult,
  CompileSuccess,
  ExecutionPlan,
  SemanticAction,
  SemanticDiagnostic,
} from "./compiler/types.js";
// ── Component states ──
export type {
  ComponentStateDef,
  ComponentStatesConfig,
  StateAPI,
} from "./component-states.js";
export { resolveStateProps } from "./component-states.js";
export {
  cleanupBindings,
  clearTransformers,
  registerTransformer,
  reResolveOnSourceChange,
  resolveBinding,
  resolveBindings,
  watchBinding,
} from "./data/binding.js";
// ── Data binding ──
export {
  BindingError,
  type DataBinding,
  type DataColumn,
  type DataRegistryVariable,
  type DataSource,
  type DataSourceId,
  DataSourceRegistry,
  type Dataset,
  type DatasetId,
  type ResolvedBinding,
  type VariableId,
} from "./data/types.js";
// ── Plugin system ──
export type {
  ComponentCapabilities,
  ComponentConstraint,
  ComponentDefaults,
  ComponentMeta,
  ComponentPlugin,
  EventMeta,
  Example,
  PropMeta,
  SlotMeta,
} from "./plugin-types.js";
// ── Plugin registry ──
export {
  ComponentPluginRegistry,
  createPluginRegistry,
} from "./plugins/registry.js";
// ── Prototype components ──
export type {
  PrototypeComponent,
  ResolvedInstance,
} from "./prototype.js";
export {
  createNodeFromPrototype,
  createPrototypeFromNode,
  detachInstance,
  resolveInstance,
} from "./prototype.js";
// ── Rich text ──
export type {
  BlockNode,
  DocNode,
  InlineNode,
  MarkNode,
} from "./rich-text.js";
export {
  EMPTY_DOC,
  extractPlainText,
  plainTextToDoc,
  validateRichText,
} from "./rich-text.js";
// ── Runtime actions ──
export type {
  BatchActions,
  CreateNodeAction,
  MoveNodeAction,
  RemoveNodeAction,
  RotateNodeAction,
  RuntimeAction,
  UpdateBindingsAction,
  UpdateLayoutAction,
  UpdatePropsAction,
  UpdateRuntimeAction,
  UpdateSelectionAction,
  UpdateStyleAction,
} from "./runtime/actions.js";
export {
  BatchActionsSchema,
  CreateNodeActionSchema,
  MoveNodeActionSchema,
  RemoveNodeActionSchema,
  RotateNodeActionSchema,
  RuntimeActionSchema,
  UpdateBindingsActionSchema,
  UpdateLayoutActionSchema,
  UpdatePropsActionSchema,
  UpdateRuntimeActionSchema,
  UpdateSelectionActionSchema,
  UpdateStyleActionSchema,
} from "./runtime/actions.js";
// ── Runtime command bus ──
export type {
  CommandBus,
  DispatchResult,
  RuntimeError,
} from "./runtime/command-bus.js";
export { RuntimeHandlerError } from "./runtime/error.js";
// ── Runtime domain types ──
export type { RuntimeContext, RuntimeHandler } from "./runtime/handler.js";
export type {
  RuntimeHandlerEntry,
  RuntimeHandlerRegistry,
} from "./runtime/handler-registry.js";
// ── Runtime registries ──
export { createDefaultRuntimeRegistries } from "./runtime/inverse.js";
export type { RuntimeMiddleware } from "./runtime/middleware.js";
export { createRuntimeCommandBus } from "./runtime/runtime-command-bus.js";
export type {
  SerializedDocument,
  SerializedEventLog,
} from "./serialization.js";
// ── Serialization ──
export {
  CURRENT_SERIALIZATION_VERSION,
  serializeDocument,
  serializeEventLog,
} from "./serialization.js";
export type {
  ActivatePageOptions,
  DocumentLifecycleEvent,
  DocumentLoadResult,
  DocumentSession,
  EditorSessionState,
} from "./session.js";
export {
  loadDocument,
  materializeScene,
  openDocumentFromSnapshot,
  openDocumentSession,
  SessionError,
} from "./session.js";
export type {
  SnapshotManager,
  SnapshotVerification,
} from "./snapshot.js";
// ── Snapshot and persistence ──
export {
  createSnapshotManager,
  DEFAULT_SNAPSHOT_INTERVAL,
  MAX_DOCUMENT_EVENT_LOG_ACTIONS,
  MAX_SCENE_EVENT_LOG_ACTIONS,
  truncateDocumentEventLog,
  truncateRuntimeEventLog,
} from "./snapshot.js";
export type { StorageBackend } from "./storage-backend.js";
export { InMemoryStorageBackend } from "./storage-backend.js";
// ── Theme ──
export { BASE_THEME, resolveTheme, resolveToken } from "./theme.js";
// ── Core types ──
export type {
  AbsoluteLayout,
  Asset,
  Binding,
  BorderTokens,
  ColorTokens,
  DocumentId,
  DocumentMetadata,
  DocumentSnapshot,
  FilterPreset,
  FlexLayout,
  FreeLayout,
  GridItemLayout,
  GridLayout,
  Layout,
  LayoutBase,
  NodeId,
  Page,
  PageId,
  PageMetadata,
  PersistedSceneGraph,
  PrototypeComponent,
  RuntimeState,
  SceneGraph,
  SceneId,
  SceneNode,
  SelectionState,
  ShadowTokens,
  SpacingTokens,
  Style,
  Theme,
  ThemeTokens,
  TypographyTokens,
  UserWorkspacePreferences,
  Variable,
  ViewportState,
  VisualDocument,
} from "./types.js";
export {
  AbsoluteLayoutSchema,
  AssetSchema,
  BorderTokensSchema,
  ColorTokensSchema,
  DocumentMetadataSchema,
  DocumentSnapshotSchema,
  FilterPresetSchema,
  FlexLayoutSchema,
  FreeLayoutSchema,
  GridItemLayoutSchema,
  GridLayoutSchema,
  LayoutSchema,
  PageMetadataSchema,
  PageSchema,
  PersistedSceneGraphSchema,
  PrototypeComponentSchema,
  SceneGraphSchema,
  SceneNodeSchema,
  SelectionStateSchema,
  ShadowTokensSchema,
  SpacingTokensSchema,
  ThemeSchema,
  ThemeTokensSchema,
  TypographyTokensSchema,
  UserWorkspacePreferencesSchema,
  VariableSchema,
  ViewportStateSchema,
  VisualDocumentSchema,
} from "./types.js";
