// ── Document actions ──

export type { NewDocumentOptions } from "./bootstrap.js";
// ── Bootstrap and lifecycle ──
export {
  createEmptyScene,
  createNewDocument,
  generateId,
} from "./bootstrap.js";
// ── Plugin system ──
export { builtinPluginDefinitions } from "./builtin-plugins.js";
export type {
  BatchDocumentActions,
  CreatePageAction,
  DocumentAction,
  RemovePageAction,
  RenamePageAction,
  ReorderPageAction,
  SetDocumentThemeAction,
  SetPageThemeAction,
  UpdatePageRouteAction,
} from "./document/actions.js";
export {
  BatchDocumentActionsSchema,
  CreatePageActionSchema,
  DocumentActionSchema,
  RemovePageActionSchema,
  RenamePageActionSchema,
  ReorderPageActionSchema,
  SetDocumentThemeActionSchema,
  SetPageThemeActionSchema,
  UpdatePageRouteActionSchema,
} from "./document/actions.js";
// ── Document command bus ──
export type {
  DocumentDispatchResult,
  DocumentRuntimeError,
} from "./document/command-bus.js";
export { createDocumentCommandBus } from "./document/document-command-bus.js";
export { DocumentHandlerError } from "./document/error.js";
// ── Document domain types ──
export type {
  DocumentHandler,
  DocumentRuntimeContext,
} from "./document/handler.js";
export type {
  DocumentHandlerEntry,
  DocumentHandlerRegistry,
} from "./document/handler-registry.js";
// ── Document registries ──
export { createDefaultDocumentRegistries } from "./document/inverse.js";
export type { DocumentMiddleware } from "./document/middleware.js";
export type {
  CompilerDiagnostic,
  EngineError,
  ErrorDomain,
  ErrorSeverity,
  RendererError,
} from "./engine/error.js";
// ── Error taxonomy ──
export { HandlerError } from "./engine/error.js";
export type {
  DispatchAPI,
  EngineAPI,
  HistoryAPI,
  NodeAPI,
  SceneAPI,
  SelectionAPI,
  StateAPI,
} from "./engine-api.js";
// ── Engine API ──
export { createEngineAPI } from "./engine-api.js";
export type {
  CollisionInfo,
  GridItemPosition,
  LayoutResult,
} from "./grid-layout.js";
// ── Grid layout ──
export {
  autoLayoutGrid,
  detectCollisions,
  resolveCollisions,
} from "./grid-layout.js";
export type { ExportOptions, ImportResult } from "./import-export.js";
// ── Import and export ──
export { exportDocument, importDocument } from "./import-export.js";
export { docToMarkdown, markdownToDoc } from "./markdown-interop.js";
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
export type {
  BlockNode,
  DocNode,
  InlineNode,
  MarkNode,
} from "./rich-text.js";
// ── Rich text ──
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
