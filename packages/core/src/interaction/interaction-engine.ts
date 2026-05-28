import type { NodeId } from "../types.js";

export type InteractionEvent =
  | { type: "selection-changed"; nodeIds: NodeId[] }
  | { type: "hover-changed"; nodeId: NodeId | undefined };

export type InteractionListener = (event: InteractionEvent) => void;

export interface InteractionEngine {
  // Selection
  getSelection(): NodeId[];
  isSelected(nodeId: NodeId): boolean;
  select(nodeIds: NodeId[]): void;
  addToSelection(nodeIds: NodeId[]): void;
  removeFromSelection(nodeIds: NodeId[]): void;
  clearSelection(): void;
  toggleSelection(nodeId: NodeId): void;

  // Hover
  getHoveredNode(): NodeId | undefined;
  setHoveredNode(nodeId: NodeId | undefined): void;

  // Subscription
  subscribe(listener: InteractionListener): () => void;

  // Lifecycle
  reset(): void;
}

export function createInteractionEngine(): InteractionEngine {
  const selectedSet = new Set<NodeId>();
  let hoveredNodeId: NodeId | undefined;
  const listeners = new Set<InteractionListener>();

  function notify(event: InteractionEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Isolate listener errors — one bad listener must not break others
      }
    }
  }

  function getSelectedArray(): NodeId[] {
    return Array.from(selectedSet);
  }

  const engine: InteractionEngine = {
    getSelection(): NodeId[] {
      return getSelectedArray();
    },

    isSelected(nodeId: NodeId): boolean {
      return selectedSet.has(nodeId);
    },

    select(nodeIds: NodeId[]): void {
      selectedSet.clear();
      for (const id of nodeIds) {
        selectedSet.add(id);
      }
      notify({ type: "selection-changed", nodeIds: getSelectedArray() });
    },

    addToSelection(nodeIds: NodeId[]): void {
      for (const id of nodeIds) {
        selectedSet.add(id);
      }
      notify({ type: "selection-changed", nodeIds: getSelectedArray() });
    },

    removeFromSelection(nodeIds: NodeId[]): void {
      for (const id of nodeIds) {
        selectedSet.delete(id);
      }
      notify({ type: "selection-changed", nodeIds: getSelectedArray() });
    },

    clearSelection(): void {
      if (selectedSet.size === 0) return;
      selectedSet.clear();
      notify({ type: "selection-changed", nodeIds: [] });
    },

    toggleSelection(nodeId: NodeId): void {
      if (selectedSet.has(nodeId)) {
        selectedSet.delete(nodeId);
      } else {
        selectedSet.add(nodeId);
      }
      notify({ type: "selection-changed", nodeIds: getSelectedArray() });
    },

    getHoveredNode(): NodeId | undefined {
      return hoveredNodeId;
    },

    setHoveredNode(nodeId: NodeId | undefined): void {
      hoveredNodeId = nodeId;
      notify({ type: "hover-changed", nodeId });
    },

    subscribe(listener: InteractionListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reset(): void {
      selectedSet.clear();
      hoveredNodeId = undefined;
    },
  };

  return engine;
}
