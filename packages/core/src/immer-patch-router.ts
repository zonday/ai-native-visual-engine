import type { Patch } from "immer";
import type { NodeField, SelectorRegistry } from "./selector/selector-registry.js";

const FIELD_MAP: Record<string, NodeField> = {
  layout: "layout",
  props: "props",
  visible: "visible",
  parentId: "parent",
  children: "children",
};

/**
 * Routes Immer patches to applyPatch on the registry.
 *
 * Immer patches describe minimal changes to a state tree:
 *   { op: "replace", path: ["nodes","a","layout"], value: {...} }
 *   { op: "add",    path: ["nodes","c"],         value: {...} }
 *   { op: "remove", path: ["nodes","b"] }
 */
export function routeImmerPatches(
  patches: readonly Patch[],
  registry: SelectorRegistry,
): void {
  for (const patch of patches) {
    const [scope, id, field] = patch.path.map(String);
    if (!scope || !id) continue;

    // Only route scene node patches
    if (scope !== "nodes") continue;

    if (patch.op === "add" && !field) {
      registry.applyPatch({ type: "add-node", nodeId: id });
    } else if (patch.op === "remove" && !field) {
      registry.applyPatch({ type: "remove-node", nodeId: id });
    } else if (field) {
      const nodeField = FIELD_MAP[field];
      if (nodeField) {
        registry.applyPatch({ type: "set-prop", nodeId: id, field: nodeField });
      }
    }
  }
}
