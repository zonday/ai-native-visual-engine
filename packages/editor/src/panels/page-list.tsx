import type { VisualDocument } from "@ai-native/core";
import { useEditorStore } from "../store.js";

export interface PageListProps {
  document: VisualDocument;
}

export function PageList({ document }: PageListProps) {
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);

  return (
    <div className="page-list" style={{ padding: 12 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Pages
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {document.pages.map((page) => (
          <li key={page.id} style={{ marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => setActivePage(page.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: activePageId === page.id ? 600 : 400,
                backgroundColor:
                  activePageId === page.id ? "#e0f2fe" : "transparent",
              }}
            >
              {page.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
