import type { DocumentSnapshot, PageId, VisualDocument } from "../types.js";
import { DocumentSnapshotSchema, VisualDocumentSchema } from "../types.js";

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

export function importDocumentSnapshot(data: unknown): ImportResult {
  const diagnostics: string[] = [];
  const parsed = DocumentSnapshotSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: [`import.invalid-format: ${parsed.error.message}`],
    };
  }

  return {
    ok: true,
    document: parsed.data.document as VisualDocument,
    diagnostics,
  };
}

export function exportDocumentSnapshot(
  document: VisualDocument,
  options?: ExportOptions,
): DocumentSnapshot {
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
    activeThemeId:
      options?.includeThemes !== false ? document.activeThemeId : undefined,
  };

  const validated = VisualDocumentSchema.safeParse(exported);
  if (!validated.success) {
    throw new Error(`Export validation failed: ${validated.error.message}`);
  }

  return { document: exported };
}
