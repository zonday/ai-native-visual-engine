import type { Layout } from "./layout.js";

export type DocumentId = string;
export type PageId = string;
export type SceneId = string;
export type NodeId = string;

export interface VisualDocument {
  id: DocumentId;
  title: string;
  pages: Page[];
  scenes: Record<SceneId, PersistedSceneGraph>;
  activeThemeId?: string;
  themes?: Theme[];
  assets?: Asset[];
  variables?: Variable[];
  prototypes?: PrototypeComponent[];
  metadata?: DocumentMetadata;
}

export interface Page {
  id: PageId;
  name: string;
  sceneId: SceneId;
  route?: string;
  themeId?: string;
  metadata?: PageMetadata;
}

export interface PageMetadata {
  icon?: string;
  hidden?: boolean;
  createdAt?: number;
  updatedAt?: number;
  filterPresets?: FilterPreset[];
}

export interface FilterPreset {
  filterComponentId: NodeId;
  dimension: string;
  value: unknown;
}

export interface DocumentMetadata {
  createdAt?: number;
  updatedAt?: number;
  ownerId?: string;
  version?: number;
}

export interface Theme {
  id: string;
  name: string;
  mode?: "light" | "dark";
  tokens: ThemeTokens;
}

export interface ThemeTokens {
  colors?: ColorTokens;
  spacing?: SpacingTokens;
  typography?: TypographyTokens;
  borders?: BorderTokens;
  shadows?: ShadowTokens;
}

export interface ColorTokens {
  background?: string;
  surface?: string;
  surfaceVariant?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
  border?: string;
  borderFocus?: string;
  accent?: string;
  accentHover?: string;
  danger?: string;
  success?: string;
  warning?: string;
  chart?: Record<string, string>;
}

export interface SpacingTokens {
  unit: number;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  componentGap?: number;
  sectionGap?: number;
}

export interface TypographyTokens {
  fontFamily?: string;
  fontFamilyMono?: string;
  fontSizeRoot?: number;
  headingScale?: number;
  bodyScale?: number;
  fontWeightHeading?: number;
  fontWeightBody?: number;
  lineHeight?: number;
}

export interface BorderTokens {
  radiusSm?: number;
  radiusMd?: number;
  radiusLg?: number;
  width?: number;
}

export interface ShadowTokens {
  sm?: string;
  md?: string;
  lg?: string;
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface Variable {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "json";
  value?: unknown;
}

export interface PrototypeComponent {
  id: string;
  name: string;
  description?: string;
  baseType: string;
  defaultProps: Record<string, unknown>;
  defaultStyle: Record<string, unknown>;
  defaultLayout?: Partial<Layout>;
}

export interface SceneGraph {
  version: number;
  rootId: NodeId;
  nodes: Record<NodeId, SceneNode>;
  selection?: SelectionState;
  viewport?: ViewportState;
  metadata?: SceneMetadata;
}

export interface PersistedSceneGraph {
  version: number;
  rootId: NodeId;
  nodes: Record<NodeId, SceneNode>;
  metadata?: SceneMetadata;
}

export interface SelectionState {
  nodeIds: NodeId[];
}

export interface ViewportState {
  zoom: number;
  x: number;
  y: number;
}

export interface SceneMetadata {
  title?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface SceneNode {
  id: NodeId;
  type: string;
  name?: string;
  parentId?: NodeId;
  children?: NodeId[];
  props?: Record<string, unknown>;
  style?: Style;
  layout?: Layout;
  bindings?: Binding[];
  runtime?: RuntimeState;
  visible?: boolean;
  locked?: boolean;
  prototypeId?: string;
  activeStates?: string[];
  metadata?: NodeMetadata;
}

export interface Style {
  [key: string]: unknown;
}

export interface RuntimeState {
  [key: string]: unknown;
}

export interface NodeMetadata {
  [key: string]: unknown;
}

export interface Binding {
  key: string;
  source: string;
  path?: string;
  transform?: string;
}

export interface DocumentSnapshot {
  document: VisualDocument;
}

export interface UserWorkspacePreferences {
  lastViewportByPage?: Record<PageId, ViewportState>;
}
