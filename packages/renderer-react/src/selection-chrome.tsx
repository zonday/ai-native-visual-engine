import type React from "react";
import { useEffect, useRef } from "react";
import type { TransformEvent } from "./renderer.js";

export interface SelectionChromeProps {
  nodeId: string;
  layout?: { mode: string; [key: string]: unknown };
  onTransform?: (event: TransformEvent) => void;
}

const HANDLE_SIZE = 8;
const ROTATE_HANDLE_SIZE = 10;
const ROTATE_OFFSET = 24;

const handleStyle: React.CSSProperties = {
  position: "absolute",
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  background: "#ffffff",
  border: "2px solid #3b82f6",
  borderRadius: "1px",
  zIndex: 10,
  cursor: "pointer",
};

const rotateHandleStyle: React.CSSProperties = {
  position: "absolute",
  width: ROTATE_HANDLE_SIZE,
  height: ROTATE_HANDLE_SIZE,
  background: "#ffffff",
  border: "2px solid #3b82f6",
  borderRadius: "50%",
  zIndex: 10,
  cursor: "grab",
  top: -ROTATE_OFFSET,
  left: "50%",
  marginLeft: -ROTATE_HANDLE_SIZE / 2,
};

const corners = [
  { label: "nw", top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { label: "ne", top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  { label: "sw", bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { label: "se", bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
];

export function SelectionChrome({
  nodeId,
  layout,
  onTransform,
}: SelectionChromeProps) {
  const dragRef = useRef<{
    handle: string;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !onTransform) return;
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const type = drag.handle === "rotate" ? "rotate" : "resize";
      onTransform({
        nodeId,
        type,
        handle: drag.handle,
        deltaX,
        deltaY,
        commit: false,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !onTransform) return;
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const type = drag.handle === "rotate" ? "rotate" : "resize";
      onTransform({
        nodeId,
        type,
        handle: drag.handle,
        deltaX,
        deltaY,
        commit: true,
      });
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onTransform, nodeId]);

  const startDrag = (handle: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY };
  };

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 9,
  };

  const isAbsolute = layout?.mode === "absolute";

  return (
    <div data-selection-chrome={nodeId} style={containerStyle}>
      {corners.map((c) => (
        <button
          key={c.label}
          type="button"
          data-handle={c.label}
          aria-label={`resize ${c.label}`}
          onMouseDown={startDrag(c.label)}
          style={{
            ...handleStyle,
            top: c.top as number | undefined,
            left: c.left as number | undefined,
            right: c.right as number | undefined,
            bottom: c.bottom as number | undefined,
          }}
        />
      ))}
      {isAbsolute && (
        <button
          type="button"
          data-handle="rotate"
          aria-label="rotate"
          onMouseDown={startDrag("rotate")}
          style={rotateHandleStyle}
        />
      )}
    </div>
  );
}
