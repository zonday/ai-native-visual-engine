import type { NodeId, PageId, ViewportState } from "@ai-native/core";
import { create } from "zustand";

export interface EditorSelectionState {
  nodeIds: NodeId[];
  setSelection: (ids: NodeId[]) => void;
  clearSelection: () => void;
  addToSelection: (id: NodeId) => void;
  removeFromSelection: (id: NodeId) => void;
}

export interface EditorViewportState {
  viewport: ViewportState;
  setViewport: (vp: ViewportState) => void;
  resetViewport: () => void;
}

export interface EditorPageState {
  activePageId: PageId | null;
  setActivePage: (id: PageId) => void;
}

export type EditorStore = EditorSelectionState &
  EditorViewportState &
  EditorPageState;

const DEFAULT_VIEWPORT: ViewportState = { x: 0, y: 0, zoom: 1 };

export const useEditorStore = create<EditorStore>((set) => ({
  nodeIds: [],
  setSelection: (ids) => set({ nodeIds: ids }),
  clearSelection: () => set({ nodeIds: [] }),
  addToSelection: (id) =>
    set((s) => ({
      nodeIds: s.nodeIds.includes(id) ? s.nodeIds : [...s.nodeIds, id],
    })),
  removeFromSelection: (id) =>
    set((s) => ({ nodeIds: s.nodeIds.filter((n) => n !== id) })),

  viewport: DEFAULT_VIEWPORT,
  setViewport: (viewport) => set({ viewport }),
  resetViewport: () => set({ viewport: DEFAULT_VIEWPORT }),

  activePageId: null,
  setActivePage: (id) => set({ activePageId: id }),
}));
