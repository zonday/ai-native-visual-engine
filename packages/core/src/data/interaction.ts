import type { NodeId, PageId } from "../types.js";
import type { FilterParam } from "./types.js";

export type { FilterParam, InteractiveBinding } from "./types.js";

export interface SelectionEvent {
  sourceComponentId: NodeId;
  sourceComponentType: string;
  dimension: string;
  value: unknown;
  label: string;
}

export interface FilterChangeEvent {
  filterComponentId: NodeId;
  dimension: string;
  value: unknown;
  operator: FilterParam["operator"];
}

export interface CrossFilterSubscription {
  dimension: string;
  dataKey: string;
}

export interface DrillDimension {
  name: string;
  children?: DrillDimension[];
}

export interface DrillState {
  currentDimension: string;
  currentValue: string | null;
  parentPath: { dimension: string; value: string }[];
  availableDimensions: string[];
}

export interface DrillThroughTarget {
  pageId: PageId;
  params: Record<string, unknown>;
  label: string;
}

export interface DataInteractionAPI {
  crossFilter(selection: SelectionEvent): void;
  drillDown(componentId: NodeId, dimension: string, value: string): void;
  drillUp(componentId: NodeId): void;
  drillThrough(componentId: NodeId, target: DrillThroughTarget): void;
  setFilter(componentId: NodeId, dimension: string, value: unknown): void;
  clearFilter(componentId: NodeId): void;
  getDrillState(componentId: NodeId): DrillState | undefined;
  getFilterState(componentId: NodeId): FilterParam[];
  subscribe(
    componentId: NodeId,
    dimensions: string[],
    callback: (params: FilterParam[]) => void,
  ): () => void;
}

type CrossFilterCallback = (params: FilterParam[]) => void;

interface ComponentState {
  drill: DrillState | undefined;
  filters: Map<string, unknown>;
  subscriptions: Map<string, CrossFilterCallback>;
}

export function createDataInteractionAPI(
  activePageId?: () => PageId | undefined,
  onDrillThrough?: (target: DrillThroughTarget) => void,
): DataInteractionAPI {
  const states = new Map<NodeId, ComponentState>();
  const activeFilters = new Map<string, unknown>();
  const crossSubscribers = new Map<
    `${string}:${string}`,
    Set<CrossFilterCallback>
  >();

  function getState(componentId: NodeId): ComponentState {
    let state = states.get(componentId);
    if (!state) {
      state = {
        drill: undefined,
        filters: new Map(),
        subscriptions: new Map(),
      };
      states.set(componentId, state);
    }
    return state;
  }

  function notifyCrossFilter(dimension: string): void {
    const params: FilterParam[] = [];
    for (const [key, value] of activeFilters) {
      params.push({ key, value, operator: "eq" });
    }
    for (const [subKey, subs] of crossSubscribers) {
      if (subKey.endsWith(`:${dimension}`) || subKey === `*:${dimension}`) {
        for (const cb of subs) {
          cb(params);
        }
      }
    }
  }

  return {
    crossFilter(selection: SelectionEvent): void {
      activeFilters.set(selection.dimension, selection.value);
      notifyCrossFilter(selection.dimension);
    },

    drillDown(componentId: NodeId, dimension: string, value: string): void {
      const state = getState(componentId);
      const current = state.drill;
      state.drill = {
        currentDimension: dimension,
        currentValue: value,
        parentPath: current
          ? [
              ...current.parentPath,
              {
                dimension: current.currentDimension,
                value: current.currentValue ?? value,
              },
            ]
          : [],
        availableDimensions: [],
      };
    },

    drillUp(componentId: NodeId): void {
      const state = getState(componentId);
      if (state.drill && state.drill.parentPath.length > 0) {
        const parent =
          state.drill.parentPath[state.drill.parentPath.length - 1];
        state.drill = {
          currentDimension: parent
            ? parent.dimension
            : state.drill.currentDimension,
          currentValue: parent ? parent.value : null,
          parentPath: state.drill.parentPath.slice(0, -1),
          availableDimensions: [],
        };
      }
    },

    drillThrough(_componentId: NodeId, target: DrillThroughTarget): void {
      if (onDrillThrough) {
        onDrillThrough(target);
      }
    },

    setFilter(componentId: NodeId, dimension: string, value: unknown): void {
      const state = getState(componentId);
      state.filters.set(dimension, value);
      activeFilters.set(dimension, value);
      notifyCrossFilter(dimension);
    },

    clearFilter(componentId: NodeId): void {
      const state = getState(componentId);
      for (const [dimension] of state.filters) {
        activeFilters.delete(dimension);
      }
      state.filters.clear();
    },

    getDrillState(componentId: NodeId): DrillState | undefined {
      return getState(componentId).drill;
    },

    getFilterState(componentId: NodeId): FilterParam[] {
      const state = getState(componentId);
      const params: FilterParam[] = [];
      for (const [key, value] of state.filters) {
        params.push({ key, value, operator: "eq" });
      }
      return params;
    },

    subscribe(
      componentId: NodeId,
      dimensions: string[],
      callback: CrossFilterCallback,
    ): () => void {
      const subscriptions = getState(componentId).subscriptions;
      const subKey = `${componentId}:${dimensions.join(",")}`;
      subscriptions.set(subKey, callback);

      for (const dim of dimensions) {
        const key: `${string}:${string}` = `${componentId}:${dim}`;
        let subs = crossSubscribers.get(key);
        if (!subs) {
          subs = new Set();
          crossSubscribers.set(key, subs);
        }
        subs.add(callback);
      }

      return () => {
        subscriptions.delete(subKey);
        for (const dim of dimensions) {
          const key: `${string}:${string}` = `${componentId}:${dim}`;
          const subs = crossSubscribers.get(key);
          if (subs) {
            subs.delete(callback);
            if (subs.size === 0) {
              crossSubscribers.delete(key);
            }
          }
        }
      };
    },
  };
}
