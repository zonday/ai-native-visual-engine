import type { InteractionEngine, SceneStore } from "@ai-native/core";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useInteraction } from "../hooks/use-interaction.js";

export interface LayersProps {
  selectorRegistry?: SceneStore;
  interactionEngine?: InteractionEngine;
  onRenameNode?: (nodeId: string, name: string) => void;
  onMoveNode?: (nodeId: string, parentId: string, index: number) => void;
  sceneKey?: number | string;
}

interface FlatItem {
  id: string;
  depth: number;
  hasChildren: boolean;
  label: string;
}

function buildFlattened(
  registry: SceneStore,
  nodeId: string,
  collapsed: Set<string>,
  depth = 0,
): FlatItem[] {
  const node = registry.getNode(nodeId);
  if (!node) return [];
  const label = node.name || `${node.type}:${nodeId.slice(0, 8)}`;
  const children = registry.getChildren(nodeId);
  const isCollapsed = collapsed.has(nodeId);
  const items: FlatItem[] = [
    { id: nodeId, depth, hasChildren: children.length > 0, label },
  ];
  if (!isCollapsed) {
    for (const child of children) {
      items.push(...buildFlattened(registry, child.id, collapsed, depth + 1));
    }
  }
  return items;
}

function SortableLayerItem({
  flatItem,
  isSelected,
  isCollapsed,
  editing,
  draft,
  onSelect,
  onToggle,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancelEdit,
}: {
  flatItem: FlatItem;
  isSelected: boolean;
  isCollapsed: boolean;
  editing: boolean;
  draft: string;
  onSelect: (e: React.MouseEvent) => void;
  onToggle: () => void;
  onStartEdit: () => void;
  onDraftChange: (v: string) => void;
  onCommit: () => void;
  onCancelEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: flatItem.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: `${flatItem.depth * 16 + 8}px`,
  };

  if (editing) {
    return (
      <div ref={setNodeRef} style={style}>
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit();
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onCommit}
          className="w-full box-border px-1 py-0.5 text-xs border border-blue-500 rounded outline-none"
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-0.5">
      <button
        type="button"
        className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onStartEdit}
        className={`flex-1 text-left px-2 py-1 rounded border-none text-xs cursor-pointer ${
          isSelected ? "bg-sky-100 text-sky-900" : "bg-transparent text-inherit"
        }`}
      >
        {flatItem.hasChildren ? (
          // biome-ignore lint/a11y/useSemanticElements: cannot nest <button> inside <button>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onToggle();
              }
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}
        {flatItem.label}
      </button>
    </div>
  );
}

export function Layers({
  selectorRegistry,
  interactionEngine,
  onRenameNode,
  onMoveNode,
  sceneKey,
}: LayersProps) {
  const { nodeIds: selectedIds } = useInteraction(interactionEngine);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneKey triggers recompute when page switches
  const flattened = useMemo(() => {
    if (!selectorRegistry) return [];
    const root = selectorRegistry.getRoot();
    if (!root) return [];
    return buildFlattened(selectorRegistry, root.id, collapsedIds);
  }, [selectorRegistry, collapsedIds, sceneKey]);

  const rootId = useMemo(
    () => selectorRegistry?.getRoot()?.id ?? "",
    [selectorRegistry],
  );

  const sortedIds = useMemo(() => flattened.map((f) => f.id), [flattened]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      if (!onMoveNode || !selectorRegistry) return;

      const draggedId = active.id as string;
      const overId = over.id as string;

      const draggedNode = selectorRegistry.getNode(draggedId);
      const overNode = selectorRegistry.getNode(overId);
      if (!draggedNode || !overNode) return;

      // Cannot drop on root
      if (overId === rootId) return;

      // Prevent dropping on own descendants
      const descendants = selectorRegistry.getDescendants(draggedId);
      if (descendants.includes(overId)) return;

      // Determine drop target: if over node is a container, drop as its child
      const overChildren = selectorRegistry.getChildren(overId);
      if (overChildren.length > 0) {
        onMoveNode(draggedId, overId, overChildren.length);
        return;
      }

      // Otherwise drop after the over node (at the same parent)
      const overParent = selectorRegistry.getParent(overId);
      if (!overParent) return;
      const siblings = selectorRegistry.getChildren(overParent.id);
      const overIndex = siblings.findIndex((s) => s.id === overId);
      if (overIndex === -1) return;

      // If the dragged node was from the same parent and before the drop
      // point, adjust index by 1 since it will be removed first
      let targetIndex = overIndex + 1;
      if (
        draggedNode.parentId === overParent.id &&
        siblings.findIndex((s) => s.id === draggedId) < overIndex
      ) {
        targetIndex = overIndex;
      }

      onMoveNode(draggedId, overParent.id, targetIndex);
    },
    [onMoveNode, selectorRegistry, rootId],
  );

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

  return (
    <div className="p-3 border-t border-slate-200">
      <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider">
        Layers
      </h3>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sortedIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-0.5">
            {flattened.map((flatItem) => (
              <SortableLayerItem
                key={flatItem.id}
                flatItem={flatItem}
                isSelected={selectedIds.includes(flatItem.id)}
                isCollapsed={collapsedIds.has(flatItem.id)}
                editing={editingId === flatItem.id}
                draft={draft}
                onSelect={(e) => {
                  if (!interactionEngine) return;
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    interactionEngine.toggleSelection(flatItem.id);
                  } else {
                    interactionEngine.select([flatItem.id]);
                  }
                }}
                onToggle={() => toggleCollapse(flatItem.id)}
                onStartEdit={() => {
                  setEditingId(flatItem.id);
                  const node = selectorRegistry?.getNode(flatItem.id);
                  const label =
                    node?.name || `${node?.type}:${flatItem.id.slice(0, 8)}`;
                  setDraft(label);
                }}
                onDraftChange={setDraft}
                onCommit={() => {
                  const node = selectorRegistry?.getNode(flatItem.id);
                  const label =
                    node?.name || `${node?.type}:${flatItem.id.slice(0, 8)}`;
                  commit(flatItem.id, label);
                }}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
