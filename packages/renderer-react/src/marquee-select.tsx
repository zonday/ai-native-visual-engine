import type React from "react";
import type { MarqueeRect } from "./renderer.js";

export interface MarqueeOverlayProps {
  rect: MarqueeRect;
}

export function MarqueeOverlay({ rect }: MarqueeOverlayProps) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    background: "rgba(59, 130, 246, 0.1)",
    border: "1px solid #3b82f6",
    pointerEvents: "none",
    zIndex: 100,
  };

  return <div data-marquee-overlay style={style} />;
}
