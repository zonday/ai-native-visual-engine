import type React from "react";

export interface SelectionChromeProps {
  nodeId: string;
  bounds: { width: number; height: number };
}

const HANDLE_SIZE = 8;

const handleStyle: React.CSSProperties = {
  position: "absolute",
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  background: "#ffffff",
  border: "2px solid #3b82f6",
  borderRadius: "1px",
  pointerEvents: "none",
  zIndex: 10,
};

const corners = [
  { label: "nw", top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { label: "ne", top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
  { label: "sw", bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
  { label: "se", bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
];

export function SelectionChrome({ nodeId, bounds }: SelectionChromeProps) {
  return (
    <div
      data-selection-chrome={nodeId}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: bounds.width,
        height: bounds.height,
        pointerEvents: "none",
        zIndex: 9,
      }}
    >
      {corners.map((c) => (
        <div
          key={c.label}
          data-handle={c.label}
          style={{
            ...handleStyle,
            top: c.top,
            left: c.left,
            right: c.right as number | undefined,
            bottom: c.bottom as number | undefined,
          }}
        />
      ))}
    </div>
  );
}
