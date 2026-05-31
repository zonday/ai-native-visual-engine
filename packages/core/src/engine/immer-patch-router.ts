import { enablePatches, type Patch, setAutoFreeze } from "immer";
import type { NodeField, ScenePatch } from "./patch-types.js";

const FIELD_MAP: Record<string, NodeField> = {
  bindings: "bindings",
  style: "style",
  layout: "layout",
  props: "props",
  visible: "visible",
  parentId: "parent",
  children: "children",
};

let patchesInitialized = false;

export function initImmerPatches(): void {
  if (patchesInitialized) return;
  patchesInitialized = true;
  enablePatches();
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
  ) {
    setAutoFreeze(true);
  }
}

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
  registry: { applyPatch(patch: ScenePatch): void },
): void {
  for (const patch of patches) {
    const [scope, id, field, ...rest] = patch.path.map(String);
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
        const key = rest[0];
        registry.applyPatch(
          key && (field === "layout" || field === "props")
            ? { type: "set-prop", nodeId: id, field: nodeField, key }
            : { type: "set-prop", nodeId: id, field: nodeField },
        );
      }
    }
  }
}
