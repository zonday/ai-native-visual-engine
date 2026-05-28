import { useRef } from "react";
import type { TransformEvent } from "./renderer.js";
import { SelectionChrome } from "./selection-chrome.js";

export interface SelectionOverlayProps {
  selectedIds: string[];
  sceneContainerRef: React.RefObject<HTMLDivElement | null>;
  layoutByNode?: Record<string, { mode: string }>;
  onTransform?: (event: TransformEvent) => void;
}

export function SelectionOverlay({
  selectedIds,
  sceneContainerRef,
  layoutByNode,
  onTransform,
}: SelectionOverlayProps) {
  // Re-read positions on every render (triggered by parent when selectedIds changes)
  const rects = useRef<Map<string, DOMRect>>(new Map());
  rects.current.clear();

  const container = sceneContainerRef.current;
  if (container) {
    const containerRect = container.getBoundingClientRect();
    for (const id of selectedIds) {
      const el = container.querySelector(
        `[data-node-id="${id}"]`,
      ) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        rects.current.set(
          id,
          new DOMRect(
            r.left - containerRect.left,
            r.top - containerRect.top,
            r.width,
            r.height,
          ),
        );
      }
    }
  }

  if (selectedIds.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {selectedIds.map((id) => {
        const r = rects.current.get(id);
        if (!r) return null;
        const layout = layoutByNode?.[id];
        return (
          <div
            key={id}
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              pointerEvents: "auto",
            }}
          >
            <SelectionChrome
              nodeId={id}
              layout={layout}
              onTransform={onTransform}
            />
          </div>
        );
      })}
    </div>
  );
}
