import { describe, expect, it } from "vitest";
import {
  createNodeFromPrototype,
  createPrototypeFromNode,
  detachInstance,
  resolveInstance,
} from "../src/prototype.js";
import type { PrototypeComponent, SceneNode } from "../src/types.js";

const proto: PrototypeComponent = {
  id: "proto-1",
  name: "Sales KPI",
  baseType: "metric-value",
  defaultProps: { label: "Revenue", value: 100, format: "currency" },
  defaultStyle: { color: "#16a34a" },
  defaultLayout: { mode: "absolute", x: 0, y: 0, width: 200, height: 100 },
};

describe("resolveInstance", () => {
  it("returns raw node when no prototypeId", () => {
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      props: { label: "Sales" },
      style: { fontSize: "14px" },
    };
    const result = resolveInstance(node, undefined);
    expect(result.props).toEqual({ label: "Sales" });
    expect(result.style).toEqual({ fontSize: "14px" });
  });

  it("returns raw node when prototypeId but no prototype found", () => {
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      prototypeId: "missing",
      props: { label: "Sales" },
    };
    const result = resolveInstance(node, undefined);
    expect(result.props).toEqual({ label: "Sales" });
  });

  it("merges prototype defaults with instance overrides", () => {
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      prototypeId: "proto-1",
      props: { label: "Sales" },
    };
    const result = resolveInstance(node, proto);
    expect(result.props).toEqual({
      label: "Sales",
      value: 100,
      format: "currency",
    });
    expect(result.style).toEqual({ color: "#16a34a" });
  });

  it("uses node layout when present", () => {
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      prototypeId: "proto-1",
      layout: { mode: "absolute", x: 10, y: 20, width: 300, height: 100 },
    };
    const result = resolveInstance(node, proto);
    expect(result.layout).toEqual({
      mode: "absolute",
      x: 10,
      y: 20,
      width: 300,
      height: 100,
    });
  });

  it("falls back to prototype layout when node layout absent", () => {
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      prototypeId: "proto-1",
    };
    const result = resolveInstance(node, proto);
    expect(result.layout).toEqual({
      mode: "absolute",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  it("returns raw node when prototype id does not match", () => {
    const otherProto: PrototypeComponent = {
      id: "proto-2",
      name: "Other",
      baseType: "metric-value",
      defaultProps: { label: "Wrong", value: 999 },
      defaultStyle: { color: "red" },
    };
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      prototypeId: "proto-1",
      props: { label: "Sales" },
    };
    const result = resolveInstance(node, otherProto);
    expect(result.props).toEqual({ label: "Sales" });
    expect(result.style).toEqual({});
  });
});

describe("createNodeFromPrototype", () => {
  it("creates node with prototypeId and default layout", () => {
    const node = createNodeFromPrototype(proto, "root-id");
    expect(node.prototypeId).toBe("proto-1");
    expect(node.type).toBe("metric-value");
    expect(node.parentId).toBe("root-id");
    expect(node.props).toEqual({});
    expect(node.layout).toEqual(proto.defaultLayout);
  });

  it("preserves an explicit layout override", () => {
    const node = createNodeFromPrototype(proto, "root-id", {
      layout: { mode: "absolute", x: 20, y: 30, width: 400, height: 120 },
    });

    expect(node.layout).toEqual({
      mode: "absolute",
      x: 20,
      y: 30,
      width: 400,
      height: 120,
    });
  });

  it("preserves its original layout when prototype layout changes later", () => {
    const node = createNodeFromPrototype(proto, "root-id");
    const updatedPrototype: PrototypeComponent = {
      ...proto,
      defaultLayout: {
        mode: "absolute",
        x: 50,
        y: 60,
        width: 320,
        height: 140,
      },
    };

    const resolved = resolveInstance(node, updatedPrototype);

    expect(resolved.layout).toEqual(proto.defaultLayout);
  });

  it("does not inherit later prototype layout changes after a local override", () => {
    const node = createNodeFromPrototype(proto, "root-id", {
      layout: { mode: "absolute", x: 5, y: 10, width: 180, height: 90 },
    });
    const updatedPrototype: PrototypeComponent = {
      ...proto,
      defaultLayout: {
        mode: "absolute",
        x: 50,
        y: 60,
        width: 320,
        height: 140,
      },
    };

    const resolved = resolveInstance(node, updatedPrototype);

    expect(resolved.layout).toEqual({
      mode: "absolute",
      x: 5,
      y: 10,
      width: 180,
      height: 90,
    });
  });
});

describe("createPrototypeFromNode", () => {
  it("copies node props and style into defaults", () => {
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      props: { label: "Revenue" },
      style: { color: "#16a34a" },
    };
    const result = createPrototypeFromNode(node, "Revenue KPI");
    expect(result.name).toBe("Revenue KPI");
    expect(result.baseType).toBe("metric-value");
    expect(result.defaultProps).toEqual({ label: "Revenue" });
    expect(result.defaultStyle).toEqual({ color: "#16a34a" });
  });
});

describe("detachInstance", () => {
  it("bakes resolved values into node and clears prototypeId", () => {
    const node: SceneNode = {
      id: "n1",
      type: "metric-value",
      prototypeId: "proto-1",
      props: { label: "Sales" },
      children: ["child-1"],
    };
    const result = detachInstance(node, proto);
    expect(result.prototypeId).toBeUndefined();
    expect(result.props).toEqual({
      label: "Sales",
      value: 100,
      format: "currency",
    });
    expect(result.style).toEqual({ color: "#16a34a" });
    expect(result.layout).toEqual(proto.defaultLayout);
    expect(result.children).toEqual(["child-1"]);
  });
});
