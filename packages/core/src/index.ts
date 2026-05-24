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
// ── Runtime engine ──
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
export type {
  CommandBus,
  DispatchResult,
  RuntimeError,
} from "./runtime/command-bus.js";
export { RuntimeHandlerError } from "./runtime/error.js";
export type {
  RuntimeEventLog,
  RuntimeEventLogEntry,
} from "./runtime/event-log.js";
export {
  appendRuntimeEvent,
  createRuntimeEventLog,
} from "./runtime/event-log.js";
export type { RuntimeContext, RuntimeHandler } from "./runtime/handler.js";

export type {
  RuntimeHandlerEntry,
  RuntimeHandlerRegistry,
} from "./runtime/handler-registry.js";
export {
  batchInverse,
  computeBatchInverse,
  createBatchHandler,
} from "./runtime/handlers/batch.js";
export {
  createNodeHandler,
  createNodeInverse,
} from "./runtime/handlers/create-node.js";
export {
  moveNodeHandler,
  moveNodeInverse,
} from "./runtime/handlers/move-node.js";
export {
  removeNodeHandler,
  removeNodeInverse,
} from "./runtime/handlers/remove-node.js";
export {
  rotateNodeHandler,
  rotateNodeInverse,
} from "./runtime/handlers/rotate-node.js";
export {
  updateBindingsHandler,
  updateBindingsInverse,
} from "./runtime/handlers/update-bindings.js";
export {
  updateLayoutHandler,
  updateLayoutInverse,
} from "./runtime/handlers/update-layout.js";
export {
  updatePropsHandler,
  updatePropsInverse,
} from "./runtime/handlers/update-props.js";
export {
  updateRuntimeHandler,
  updateRuntimeInverse,
} from "./runtime/handlers/update-runtime.js";
export {
  updateSelectionHandler,
  updateSelectionInverse,
} from "./runtime/handlers/update-selection.js";
export {
  updateStyleHandler,
  updateStyleInverse,
} from "./runtime/handlers/update-style.js";
export type {
  RuntimeHistoryEntry,
  RuntimeHistoryState,
} from "./runtime/history.js";
export {
  createRuntimeHistoryState,
  DEFAULT_MAX_RUNTIME_UNDO_STACK,
  pushRuntimeUndo,
  redoRuntimeAction,
  undoRuntimeAction,
} from "./runtime/history.js";
export { createUndoHistoryMiddleware as createRuntimeUndoHistoryMiddleware } from "./runtime/history-middleware.js";
export type {
  InverseComputer as RuntimeInverseComputer,
  InverseRegistry as RuntimeInverseRegistry,
} from "./runtime/inverse.js";
export {
  computeInverseAction as computeRuntimeInverseAction,
  createDefaultRuntimeRegistries,
  createInverseRegistry as createRuntimeInverseRegistry,
} from "./runtime/inverse.js";
export { runtimeLoggerMiddleware } from "./runtime/middleware/logger.js";
export { runtimeValidatorMiddleware } from "./runtime/middleware/validator.js";
export type { RuntimeMiddleware } from "./runtime/middleware.js";
export { createRuntimeCommandBus } from "./runtime/runtime-command-bus.js";
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
