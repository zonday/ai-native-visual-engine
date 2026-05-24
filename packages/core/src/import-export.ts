import { VisualDocumentSchema, DocumentSnapshotSchema } from "./types.js";
import type { VisualDocument, DocumentId, PageId } from "./types.js";
import { generateId } from "./bootstrap.js";

export interface ImportResult {
  ok: boolean;
  document?: VisualDocument;
  diagnostics: string[];
}

export interface ExportOptions {
  targetPageIds?: PageId[];
  includeThemes?: boolean;
  includeAssets?: boolean;
}

export function importDocument(
  data: unknown,
): ImportResult {
  const diagnostics: string[] = [];
  const parsed = VisualDocumentSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: [...diagnostics, parsed.error.message],
    };
  }

  return {
    ok: true,
    document: parsed.data as VisualDocument,
    diagnostics,
  };
}

export function exportDocument(
  document: VisualDocument,
  options?: ExportOptions,
): VisualDocument {
  const targetIds = new Set(options?.targetPageIds);

  const pages = options?.targetPageIds
    ? document.pages.filter((p) => targetIds.has(p.id))
    : [...document.pages];

  const sceneIds = new Set(pages.map((p) => p.sceneId));
  const scenes = Object.fromEntries(
    Object.entries(document.scenes).filter(([id]) => sceneIds.has(id)),
  );

  const exported: VisualDocument = {
    ...document,
    pages,
    scenes,
    activeThemeId: options?.includeThemes !== false ? document.activeThemeId : undefined,
  };

  const validated = VisualDocumentSchema.safeParse(exported);
  if (!validated.success) {
    throw new Error(`Export validation failed: ${validated.error.message}`);
  }

  return exported;
}
