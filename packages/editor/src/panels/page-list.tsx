import type { VisualDocument } from "@ai-native/core";
import {
  closestCenter,
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
import { useCallback, useState } from "react";
import { useEditorStore } from "../store.js";

export interface PageListProps {
  document: VisualDocument;
  onRenamePage?: (pageId: string, name: string) => void;
  onReorderPage?: (pageId: string, index: number) => void;
}

function SortablePage({
  page,
  isActive,
  editing,
  draft,
  onSelect,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancelEdit,
}: {
  page: { id: string; name: string };
  isActive: boolean;
  editing: boolean;
  draft: string;
  onSelect: () => void;
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
  } = useSortable({ id: page.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (editing) {
    return (
      <li ref={setNodeRef} style={style} className="mb-1">
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
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} className="mb-1 flex items-center gap-1">
      <button
        type="button"
        className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-600 text-xs"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onStartEdit}
        className={`flex-1 text-left px-2 py-1.5 rounded border-none text-xs cursor-pointer ${
          isActive ? "bg-sky-100 font-semibold" : "bg-transparent font-normal"
        }`}
      >
        {page.name}
      </button>
    </li>
  );
}

export function PageList({
  document,
  onRenamePage,
  onReorderPage,
}: PageListProps) {
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = document.pages.findIndex((p) => p.id === active.id);
      const newIndex = document.pages.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      onReorderPage?.(active.id as string, newIndex);
    },
    [document.pages, onReorderPage],
  );

  const commit = useCallback(
    (pageId: string, originalName: string) => {
      setEditingId(null);
      const trimmed = draft.trim();
      if (trimmed && trimmed !== originalName && onRenamePage) {
        onRenamePage(pageId, trimmed);
      }
    },
    [draft, onRenamePage],
  );

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider">
        Pages
      </h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={document.pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="list-none p-0 m-0">
            {document.pages.map((page) => (
              <SortablePage
                key={page.id}
                page={page}
                isActive={activePageId === page.id}
                editing={editingId === page.id}
                draft={draft}
                onSelect={() => setActivePage(page.id)}
                onStartEdit={() => {
                  setEditingId(page.id);
                  setDraft(page.name);
                }}
                onDraftChange={setDraft}
                onCommit={() => commit(page.id, page.name)}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
