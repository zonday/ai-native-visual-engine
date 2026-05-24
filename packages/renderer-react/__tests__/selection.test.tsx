import { describe, it, expect } from "vitest";
import { SelectionChrome } from "../src/selection-chrome.jsx";
import { MarqueeOverlay } from "../src/marquee-select.jsx";

describe("SelectionChrome", () => {
  it("renders with given node id and bounds", () => {
    const result = SelectionChrome({
      nodeId: "node-1",
      bounds: { width: 200, height: 100 },
    });
    expect(result).toBeDefined();
  });
});

describe("MarqueeOverlay", () => {
  it("renders with given rectangle", () => {
    const result = MarqueeOverlay({
      rect: { x: 10, y: 20, width: 300, height: 150 },
    });
    expect(result).toBeDefined();
  });
});
