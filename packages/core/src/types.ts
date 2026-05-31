import { z } from "zod/v4";

// ── IDs ──
export type DocumentId = string;
export type PageId = string;
export type SceneId = string;
export type NodeId = string;

// ── Theme ──
export const ColorTokensSchema = z.object({
  background: z.string().optional(),
  surface: z.string().optional(),
  surfaceVariant: z.string().optional(),
  textPrimary: z.string().optional(),
  textSecondary: z.string().optional(),
  textMuted: z.string().optional(),
  border: z.string().optional(),
  borderFocus: z.string().optional(),
  accent: z.string().optional(),
  accentHover: z.string().optional(),
  danger: z.string().optional(),
  success: z.string().optional(),
  warning: z.string().optional(),
  chart: z.record(z.string(), z.string()).optional(),
});

export const SpacingTokensSchema = z.object({
  unit: z.number(),
  xs: z.number().optional(),
  sm: z.number().optional(),
  md: z.number().optional(),
  lg: z.number().optional(),
  xl: z.number().optional(),
  componentGap: z.number().optional(),
  sectionGap: z.number().optional(),
});

export const TypographyTokensSchema = z.object({
  fontFamily: z.string().optional(),
  fontFamilyMono: z.string().optional(),
  fontSizeRoot: z.number().optional(),
  headingScale: z.number().optional(),
  bodyScale: z.number().optional(),
  fontWeightHeading: z.number().optional(),
  fontWeightBody: z.number().optional(),
  lineHeight: z.number().optional(),
});

export const BorderTokensSchema = z.object({
  radiusSm: z.number().optional(),
  radiusMd: z.number().optional(),
  radiusLg: z.number().optional(),
  width: z.number().optional(),
});

export const ShadowTokensSchema = z.object({
  sm: z.string().optional(),
  md: z.string().optional(),
  lg: z.string().optional(),
});

export const ThemeTokensSchema = z.object({
  colors: ColorTokensSchema.optional(),
  spacing: SpacingTokensSchema.optional(),
  typography: TypographyTokensSchema.optional(),
  borders: BorderTokensSchema.optional(),
  shadows: ShadowTokensSchema.optional(),
});

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.enum(["light", "dark"]).optional(),
  tokens: ThemeTokensSchema,
});

export type ColorTokens = z.infer<typeof ColorTokensSchema>;
export type SpacingTokens = z.infer<typeof SpacingTokensSchema>;
export type TypographyTokens = z.infer<typeof TypographyTokensSchema>;
export type BorderTokens = z.infer<typeof BorderTokensSchema>;
export type ShadowTokens = z.infer<typeof ShadowTokensSchema>;
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type Theme = z.infer<typeof ThemeSchema>;

// ── Asset, Variable ──
export const AssetSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  url: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const VariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "json"]),
  value: z.unknown().optional(),
});

export type Asset = z.infer<typeof AssetSchema>;
export type Variable = z.infer<typeof VariableSchema>;

// ── Layout ──
export const FreeLayoutSchema = z.object({
  mode: z.literal("free"),
});

export const AbsoluteLayoutSchema = z.object({
  mode: z.literal("absolute"),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  zIndex: z.number().optional(),
});

export const FlexLayoutSchema = z.object({
  mode: z.literal("flex"),
  direction: z.enum(["horizontal", "vertical"]),
  gap: z.number().optional(),
  align: z.enum(["start", "center", "end", "stretch"]).optional(),
  justify: z.enum(["start", "center", "end", "space-between"]).optional(),
  wrap: z.boolean().optional(),
});

export const GridLayoutSchema = z.object({
  mode: z.literal("grid"),
  columns: z.number(),
  rowHeight: z.number(),
  gap: z.number(),
  autoFlow: z.enum(["row", "column"]).optional(),
});

export const GridItemLayoutSchema = z.object({
  mode: z.literal("grid-item"),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
});

export const LayoutSchema = z.discriminatedUnion("mode", [
  FreeLayoutSchema,
  AbsoluteLayoutSchema,
  FlexLayoutSchema,
  GridLayoutSchema,
  GridItemLayoutSchema,
]);

export type Layout = z.infer<typeof LayoutSchema>;
export type FreeLayout = z.infer<typeof FreeLayoutSchema>;
export type AbsoluteLayout = z.infer<typeof AbsoluteLayoutSchema>;
export type FlexLayout = z.infer<typeof FlexLayoutSchema>;
export type GridLayout = z.infer<typeof GridLayoutSchema>;
export type GridItemLayout = z.infer<typeof GridItemLayoutSchema>;

export interface LayoutBase {
  mode: "free" | "absolute" | "flex" | "grid" | "grid-item";
}

// ── Binding ──
export const BindingSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
  path: z.string().optional(),
  transform: z.string().optional(),
});

export type Binding = z.infer<typeof BindingSchema>;

export interface Style {
  [key: string]: unknown;
}

export interface RuntimeState {
  [key: string]: unknown;
}

export interface NodeMetadata {
  label?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
}

// ── Page ──
export const FilterPresetSchema = z.object({
  filterComponentId: z.string(),
  dimension: z.string(),
  value: z.unknown(),
});

export const PageMetadataSchema = z.object({
  icon: z.string().optional(),
  hidden: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  filterPresets: z.array(FilterPresetSchema).optional(),
});

export const PageSchema = z.object({
  id: z.string(),
  name: z.string(),
  sceneId: z.string(),
  route: z.string().optional(),
  themeId: z.string().optional(),
  metadata: PageMetadataSchema.optional(),
});

export type FilterPreset = z.infer<typeof FilterPresetSchema>;
export type PageMetadata = z.infer<typeof PageMetadataSchema>;
export type Page = z.infer<typeof PageSchema>;

// ── Scene ──
export const SceneNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string().optional(),
  parentId: z.string().optional(),
  children: z.array(z.string()).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  style: z.record(z.string(), z.unknown()).optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
  bindings: z.array(BindingSchema).optional(),
  runtime: z.record(z.string(), z.unknown()).optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  prototypeId: z.string().optional(),
  activeStates: z.array(z.string()).optional(),
});

export const PersistedSceneNodeSchema = SceneNodeSchema.omit({
  activeStates: true,
  layout: true,
})
  .extend({
    layout: LayoutSchema.optional(),
  })
  .strict();

export const PersistedSceneGraphSchema = z
  .object({
    version: z.number(),
    rootId: z.string(),
    nodes: z.record(z.string(), PersistedSceneNodeSchema),
    metadata: z
      .object({
        title: z.string().optional(),
        createdAt: z.number().optional(),
        updatedAt: z.number().optional(),
      })
      .optional(),
  })
  .strict();

export const SelectionStateSchema = z.object({
  nodeIds: z.array(z.string()),
});

export const ViewportStateSchema = z.object({
  zoom: z.number(),
  x: z.number(),
  y: z.number(),
});

export const SceneGraphSchema = z.object({
  version: z.number(),
  rootId: z.string(),
  nodes: z.record(z.string(), SceneNodeSchema),
  selection: SelectionStateSchema.optional(),
  viewport: ViewportStateSchema.optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      createdAt: z.number().optional(),
      updatedAt: z.number().optional(),
    })
    .optional(),
});

export type PersistedSceneGraph = z.infer<typeof PersistedSceneGraphSchema>;
export type SelectionState = z.infer<typeof SelectionStateSchema>;
export type ViewportState = z.infer<typeof ViewportStateSchema>;
export type SceneNode = DeepReadonly<z.infer<typeof SceneNodeSchema>>;
/** Mutable version of SceneNode for use inside Immer produce() callbacks. */
export type MutableSceneNode = z.infer<typeof SceneNodeSchema>;
export type SceneGraph = z.infer<typeof SceneGraphSchema>;

// ── Deep Readonly Utilities ──
// DeepReadonly makes all properties (including nested objects) readonly
// at the type level. DeepMutable is the inverse for explicit escape hatches.
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends (...args: never) => unknown
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};

export type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends object
    ? T[K] extends (...args: never) => unknown
      ? T[K]
      : DeepMutable<T[K]>
    : T[K];
};

// ── Document ──
export const PrototypeComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  baseType: z.string(),
  defaultProps: z.record(z.string(), z.unknown()),
  defaultStyle: z.record(z.string(), z.unknown()),
  defaultLayout: LayoutSchema.optional(),
});

export const DocumentMetadataSchema = z.object({
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  ownerId: z.string().optional(),
  version: z.number().optional(),
});

export const VisualDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  pages: z.array(PageSchema),
  scenes: z.record(z.string(), PersistedSceneGraphSchema),
  activeThemeId: z.string().optional(),
  themes: z.array(ThemeSchema).optional(),
  assets: z.array(AssetSchema).optional(),
  variables: z.array(VariableSchema).optional(),
  prototypes: z.array(PrototypeComponentSchema).optional(),
  metadata: DocumentMetadataSchema.optional(),
});

export const DocumentSnapshotSchema = z.object({
  document: VisualDocumentSchema,
});

export const UserWorkspacePreferencesSchema = z.object({
  lastViewportByPage: z.record(z.string(), ViewportStateSchema).optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
export type PrototypeComponent = z.infer<typeof PrototypeComponentSchema>;
export type VisualDocument = z.infer<typeof VisualDocumentSchema>;
export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>;
export type UserWorkspacePreferences = z.infer<
  typeof UserWorkspacePreferencesSchema
>;
