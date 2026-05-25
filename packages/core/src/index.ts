// ── Document actions ──
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

// ── Document domain types ──
export type {
  DocumentHandler,
  DocumentRuntimeContext,
} from "./document/handler.js";
export type {
  DocumentHandlerEntry,
  DocumentHandlerRegistry,
} from "./document/handler-registry.js";
export type { DocumentMiddleware } from "./document/middleware.js";
export { DocumentHandlerError } from "./document/error.js";

// ── Document registries ──
export { createDefaultDocumentRegistries } from "./document/inverse.js";

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
export { createRuntimeCommandBus } from "./runtime/runtime-command-bus.js";

// ── Runtime domain types ──
export type { RuntimeContext, RuntimeHandler } from "./runtime/handler.js";
export type {
  RuntimeHandlerEntry,
  RuntimeHandlerRegistry,
} from "./runtime/handler-registry.js";
export type { RuntimeMiddleware } from "./runtime/middleware.js";
export { RuntimeHandlerError } from "./runtime/error.js";

// ── Error taxonomy ──
export { HandlerError } from "./engine/error.js";
export type {
  EngineError,
  ErrorSeverity,
  ErrorDomain,
  CompilerDiagnostic,
  RendererError,
} from "./engine/error.js";

// ── Runtime registries ──
export { createDefaultRuntimeRegistries } from "./runtime/inverse.js";

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
export type {
  BlockNode,
  DocNode,
  InlineNode,
  MarkNode,
} from "./rich-text.js";
export {
  AssetSchema,
  BorderTokensSchema,
  ColorTokensSchema,
  DocumentMetadataSchema,
  DocumentSnapshotSchema,
  FilterPresetSchema,
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
  LayoutSchema,
  FreeLayoutSchema,
  AbsoluteLayoutSchema,
  FlexLayoutSchema,
  GridLayoutSchema,
  GridItemLayoutSchema,
} from "./types.js";

// ── Bootstrap and lifecycle ──
export {
  createNewDocument,
  createEmptyScene,
  generateId,
} from "./bootstrap.js";
export type { NewDocumentOptions } from "./bootstrap.js";

export {
  openDocumentSession,
  openDocumentFromSnapshot,
  loadDocument,
  materializeScene,
  SessionError,
} from "./session.js";
export type {
  EditorSessionState,
  DocumentSession,
  ActivatePageOptions,
  DocumentLifecycleEvent,
  DocumentLoadResult,
} from "./session.js";

// ── Snapshot and persistence ──
export {
  createSnapshotManager,
  truncateDocumentEventLog,
  truncateRuntimeEventLog,
  DEFAULT_SNAPSHOT_INTERVAL,
  MAX_DOCUMENT_EVENT_LOG_ACTIONS,
  MAX_SCENE_EVENT_LOG_ACTIONS,
} from "./snapshot.js";
export type {
  SnapshotManager,
  SnapshotVerification,
} from "./snapshot.js";

export type { StorageBackend } from "./storage-backend.js";
export { InMemoryStorageBackend } from "./storage-backend.js";

// ── Serialization ──
export {
  serializeDocument,
  serializeEventLog,
  CURRENT_SERIALIZATION_VERSION,
} from "./serialization.js";
export type {
  SerializedDocument,
  SerializedEventLog,
} from "./serialization.js";

// ── Import and export ──
export { importDocument, exportDocument } from "./import-export.js";
export type { ImportResult, ExportOptions } from "./import-export.js";

// ── Engine API ──
export { createEngineAPI } from "./engine-api.js";
export type {
  EngineAPI,
  NodeAPI,
  SceneAPI,
  SelectionAPI,
  HistoryAPI,
  DispatchAPI,
  StateAPI,
} from "./engine-api.js";

// ── Theme ──
export { BASE_THEME, resolveTheme, resolveToken } from "./theme.js";

// ── Grid layout ──
export { autoLayoutGrid, detectCollisions, resolveCollisions } from "./grid-layout.js";
export type { CollisionInfo, GridItemPosition, LayoutResult } from "./grid-layout.js";

// ── Rich text ──
export {
  EMPTY_DOC,
  extractPlainText,
  plainTextToDoc,
  validateRichText,
} from "./rich-text.js";
export { docToMarkdown, markdownToDoc } from "./markdown-interop.js";
