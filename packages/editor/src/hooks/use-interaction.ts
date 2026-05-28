import type { InteractionEngine, NodeId } from "@ai-native/core";
import { useEffect, useState } from "react";

export function useInteraction(engine: InteractionEngine | undefined): {
  nodeIds: NodeId[];
  hoveredNodeId: NodeId | undefined;
} {
  const [nodeIds, setNodeIds] = useState<NodeId[]>(
    () => engine?.getSelection() ?? [],
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<NodeId | undefined>(() =>
    engine?.getHoveredNode(),
  );

  useEffect(() => {
    if (!engine) return;
    setNodeIds(engine.getSelection());
    setHoveredNodeId(engine.getHoveredNode());
    return engine.subscribe((event) => {
      if (event.type === "selection-changed") {
        setNodeIds(event.nodeIds);
      } else if (event.type === "hover-changed") {
        setHoveredNodeId(event.nodeId);
      }
    });
  }, [engine]);

  return { nodeIds, hoveredNodeId };
}
