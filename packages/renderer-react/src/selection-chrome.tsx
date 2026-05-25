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
const STROKE_COLOR = "#3b82f6";
const STROKE_WIDTH = 2;

const corners: Array<{
  label: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}> = [
  { label: "nw", top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { label: "ne", top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  { label: "sw", bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { label: "se", bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
];

const handleStyle: React.CSSProperties = {
  position: "absolute",
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  background: "#ffffff",
  border: "2px solid #3b82f6",
  borderRadius: "1px",
  zIndex: 10,
  cursor: "pointer",
  pointerEvents: "auto",
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
  pointerEvents: "auto",
  top: -ROTATE_OFFSET,
  left: "50%",
  marginLeft: -ROTATE_HANDLE_SIZE / 2,
};

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

  const onTransformRef = useRef(onTransform);
  onTransformRef.current = onTransform;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || !onTransformRef.current) return;
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const type = drag.handle === "rotate" ? "rotate" : "resize";
      onTransformRef.current({
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
      if (!drag) return;
      if (onTransformRef.current) {
        const deltaX = e.clientX - drag.startX;
        const deltaY = e.clientY - drag.startY;
        const type = drag.handle === "rotate" ? "rotate" : "resize";
        onTransformRef.current({
          nodeId,
          type,
          handle: drag.handle,
          deltaX,
          deltaY,
          commit: true,
        });
      }
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [nodeId]);

  const startDrag = (handle: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY };
  };

  const isAbsolute = layout?.mode === "absolute";
  const showHandles = !!onTransform;

  const svgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 9,
    overflow: "visible",
  };

  const handlesContainerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10,
  };

  return (
    <>
      <svg
        data-selection-chrome={nodeId}
        width="100%"
        height="100%"
        style={svgStyle}
        aria-hidden="true"
      >
        <title>Selection</title>
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill="none"
          stroke={STROKE_COLOR}
          strokeWidth={STROKE_WIDTH}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showHandles && (
        <div
          data-selection-chrome-handles={nodeId}
          style={handlesContainerStyle}
        >
          {corners.map((c) => (
            <button
              key={c.label}
              type="button"
              data-handle={c.label}
              aria-label={`resize ${c.label}`}
              onMouseDown={startDrag(c.label)}
              style={{
                ...handleStyle,
                top: c.top,
                left: c.left,
                right: c.right,
                bottom: c.bottom,
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
      )}
    </>
  );
}
