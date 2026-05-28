import type { InteractionEngine, SelectorRegistry } from "@ai-native/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInteraction } from "../hooks/use-interaction.js";

export interface LayersProps {
  selectorRegistry?: SelectorRegistry;
  interactionEngine?: InteractionEngine;
  onRenameNode?: (nodeId: string, name: string) => void;
}

export function Layers({
  selectorRegistry,
  interactionEngine,
  onRenameNode,
}: LayersProps) {
  const { nodeIds: selectedIds } = useInteraction(interactionEngine);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const commit = useCallback(
    (nodeId: string, originalName: string) => {
      setEditingId(null);
      const trimmed = draft.trim();
      if (trimmed && trimmed !== originalName && onRenameNode) {
        onRenameNode(nodeId, trimmed);
      }
    },
    [draft, onRenameNode],
  );

  const nodes = selectorRegistry ? selectorRegistry.getAllNodes() : [];

  return (
    <div className="p-3 border-t border-slate-200">
      <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider">
        Layers
      </h3>
      <ul className="list-none p-0 m-0">
        {nodes.map((node) => {
          const label = node.name || `${node.type}:${node.id.slice(0, 8)}`;

          if (editingId === node.id) {
            return (
              <li key={node.id} className="mb-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(node.id, label);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => commit(node.id, label)}
                  className="w-full box-border px-1 py-0.5 text-xs border border-blue-500 rounded outline-none"
                />
              </li>
            );
          }

          return (
            <li key={node.id} className="mb-1">
              <button
                type="button"
                onClick={(e) => {
                  if (!interactionEngine) return;
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    interactionEngine.toggleSelection(node.id);
                  } else {
                    interactionEngine.select([node.id]);
                  }
                }}
                onDoubleClick={() => {
                  setEditingId(node.id);
                  setDraft(label);
                }}
                className={`w-full text-left px-2 py-1 rounded border-none text-xs cursor-pointer ${
                  selectedIds.includes(node.id)
                    ? "bg-sky-100 text-sky-900"
                    : "bg-transparent text-inherit"
                }`}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
