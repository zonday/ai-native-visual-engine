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

export type {
  DocumentDispatchResult,
  DocumentRuntimeError,
} from "./document/command-bus.js";

export { createDocumentCommandBus } from "./document/document-command-bus.js";
export type {
  DocumentEventLog,
  DocumentEventLogEntry,
} from "./document/event-log.js";
export {
  appendDocumentEvent,
  createDocumentEventLog,
} from "./document/event-log.js";
export type {
  DocumentHandler,
  DocumentRuntimeContext,
} from "./document/handler.js";
export type {
  DocumentHandlerEntry,
  DocumentHandlerRegistry,
} from "./document/handler-registry.js";
export { normalizeRoute } from "./document/handlers/update-page-route.js";
export type {
  DocumentHistoryEntry,
  DocumentHistoryState,
  HistoryEntry,
  HistoryState,
} from "./document/history.js";
export {
  createDocumentHistoryState,
  DEFAULT_MAX_DOCUMENT_UNDO_STACK,
  pushDocumentUndo,
  redoDocumentAction,
  undoDocumentAction,
} from "./document/history.js";
export { createUndoHistoryMiddleware } from "./document/history-middleware.js";
export type { InverseComputer, InverseRegistry } from "./document/inverse.js";
export { createDefaultDocumentRegistries } from "./document/inverse.js";
export {
  computeInverseAction,
  createInverseRegistry,
} from "./document/inverse-registry.js";

export { documentValidatorMiddleware } from "./document/middleware/validator.js";
export type { DocumentMiddleware } from "./document/middleware.js";
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
} from "./types.js";
