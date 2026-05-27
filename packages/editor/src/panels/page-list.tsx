import type { VisualDocument } from "@ai-native/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "../store.js";

export interface PageListProps {
  document: VisualDocument;
  onRenamePage?: (pageId: string, name: string) => void;
}

export function PageList({ document, onRenamePage }: PageListProps) {
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const commit = useCallback(
    (pageId: string, originalName: string) => {
      setEditingId(null);
      const trimmed = draft.trim();
      if (trimmed && trimmed !== originalName && onRenamePage) {
        onRenamePage(pageId, trimmed);
      }
    },
    [draft, onRenamePage],
  );

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider">
        Pages
      </h3>
      <ul className="list-none p-0 m-0">
        {document.pages.map((page) => {
          if (editingId === page.id) {
            return (
              <li key={page.id} className="mb-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(page.id, page.name);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => commit(page.id, page.name)}
                  className="w-full box-border px-1 py-0.5 text-xs border border-blue-500 rounded outline-none"
                />
              </li>
            );
          }

          return (
            <li key={page.id} className="mb-1">
              <button
                type="button"
                onClick={() => setActivePage(page.id)}
                onDoubleClick={() => {
                  setEditingId(page.id);
                  setDraft(page.name);
                }}
                className={`w-full text-left px-2 py-1.5 rounded border-none text-xs cursor-pointer ${
                  activePageId === page.id
                    ? "bg-sky-100 font-semibold"
                    : "bg-transparent font-normal"
                }`}
              >
                {page.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
