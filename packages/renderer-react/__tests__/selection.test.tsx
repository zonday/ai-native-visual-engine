import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarqueeOverlay } from "../src/marquee-select.jsx";
import { SelectionChrome } from "../src/selection-chrome.jsx";

describe("SelectionChrome", () => {
  it("renders data-selection-chrome attribute with node id", () => {
    const html = renderToString(<SelectionChrome nodeId="node-1" />);
    expect(html).toContain('data-selection-chrome="node-1"');
  });

  it("renders all four handle positions", () => {
    const html = renderToString(
      <SelectionChrome nodeId="n1" onTransform={() => {}} />,
    );
    expect(html).toContain('data-handle="nw"');
    expect(html).toContain('data-handle="ne"');
    expect(html).toContain('data-handle="sw"');
    expect(html).toContain('data-handle="se"');
  });

  it("renders rotate handle for absolute layout", () => {
    const html = renderToString(
      <SelectionChrome
        nodeId="n1"
        layout={{ mode: "absolute" }}
        onTransform={() => {}}
      />,
    );
    expect(html).toContain('data-handle="rotate"');
  });

  it("does not render rotate handle for non-absolute layout", () => {
    const html = renderToString(
      <SelectionChrome
        nodeId="n1"
        layout={{ mode: "grid-item" }}
        onTransform={() => {}}
      />,
    );
    expect(html).not.toContain('data-handle="rotate"');
  });
});

describe("MarqueeOverlay", () => {
  it("renders data-marquee-overlay attribute", () => {
    const html = renderToString(
      <MarqueeOverlay rect={{ x: 10, y: 20, width: 300, height: 150 }} />,
    );
    expect(html).toContain("data-marquee-overlay");
  });
});
