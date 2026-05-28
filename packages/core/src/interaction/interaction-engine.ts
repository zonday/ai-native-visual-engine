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
  let selectedNodeIds: NodeId[] = [];
  let hoveredNodeId: NodeId | undefined;
  const listeners = new Set<InteractionListener>();

  function notify(event: InteractionEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  const engine: InteractionEngine = {
    getSelection(): NodeId[] {
      return selectedNodeIds;
    },

    isSelected(nodeId: NodeId): boolean {
      return selectedNodeIds.includes(nodeId);
    },

    select(nodeIds: NodeId[]): void {
      selectedNodeIds = [...nodeIds];
      notify({ type: "selection-changed", nodeIds: selectedNodeIds });
    },

    addToSelection(nodeIds: NodeId[]): void {
      const set = new Set([...selectedNodeIds, ...nodeIds]);
      selectedNodeIds = Array.from(set);
      notify({ type: "selection-changed", nodeIds: selectedNodeIds });
    },

    removeFromSelection(nodeIds: NodeId[]): void {
      const removed = new Set(nodeIds);
      selectedNodeIds = selectedNodeIds.filter((id) => !removed.has(id));
      notify({ type: "selection-changed", nodeIds: selectedNodeIds });
    },

    clearSelection(): void {
      if (selectedNodeIds.length === 0) return;
      selectedNodeIds = [];
      notify({ type: "selection-changed", nodeIds: [] });
    },

    toggleSelection(nodeId: NodeId): void {
      if (selectedNodeIds.includes(nodeId)) {
        engine.removeFromSelection([nodeId]);
      } else {
        engine.addToSelection([nodeId]);
      }
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
      selectedNodeIds = [];
      hoveredNodeId = undefined;
    },
  };

  return engine;
}
