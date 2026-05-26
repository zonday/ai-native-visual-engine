import { describe, it, expect, beforeEach } from "vitest";
import {
  createDataInteractionAPI,
  type DataInteractionAPI,
  type SelectionEvent,
} from "../src/data/interaction.js";

describe("DataInteractionAPI", () => {
  let api: DataInteractionAPI;

  beforeEach(() => {
    api = createDataInteractionAPI();
  });

  describe("crossFilter", () => {
    it("broadcasts filter params to subscribed components on matching dimension", () => {
      let received: unknown = null;
      api.subscribe("table-1", ["region"], (params) => {
        received = params;
      });

      api.crossFilter({
        sourceComponentId: "chart-1",
        sourceComponentType: "chart",
        dimension: "region",
        value: "EMEA",
        label: "Europe",
      });

      expect(received).toEqual([{ key: "region", value: "EMEA", operator: "eq" }]);
    });

    it("does not notify subscribers on different dimensions", () => {
      let received = false;
      api.subscribe("chart-1", ["quarter"], () => {
        received = true;
      });

      api.crossFilter({
        sourceComponentId: "chart-2",
        sourceComponentType: "chart",
        dimension: "region",
        value: "EMEA",
        label: "Europe",
      });

      expect(received).toBe(false);
    });

    it("accumulates multiple filters from different sources", () => {
      let received: unknown = null;
      api.subscribe("chart-1", ["region", "quarter"], (params) => {
        received = params;
      });

      api.crossFilter({
        sourceComponentId: "chart-1",
        sourceComponentType: "chart",
        dimension: "region",
        value: "EMEA",
        label: "Europe",
      });

      api.crossFilter({
        sourceComponentId: "chart-2",
        sourceComponentType: "chart",
        dimension: "quarter",
        value: "Q1",
        label: "Q1 2026",
      });

      expect(received).toEqual([
        { key: "region", value: "EMEA", operator: "eq" },
        { key: "quarter", value: "Q1", operator: "eq" },
      ]);
    });

    it("last selection wins for the same dimension", () => {
      let received: unknown = null;
      api.subscribe("table-1", ["region"], (params) => {
        received = params;
      });

      api.crossFilter({
        sourceComponentId: "chart-1",
        sourceComponentType: "chart",
        dimension: "region",
        value: "EMEA",
        label: "Europe",
      });

      api.crossFilter({
        sourceComponentId: "chart-2",
        sourceComponentType: "chart",
        dimension: "region",
        value: "APAC",
        label: "Asia",
      });

      expect(received).toEqual([{ key: "region", value: "APAC", operator: "eq" }]);
    });

    it("unsubscribe removes callback", () => {
      let callCount = 0;
      const unsub = api.subscribe("table-1", ["region"], () => {
        callCount++;
      });

      api.crossFilter({
        sourceComponentId: "chart-1",
        sourceComponentType: "chart",
        dimension: "region",
        value: "EMEA",
        label: "Europe",
      });
      expect(callCount).toBe(1);

      unsub();

      api.crossFilter({
        sourceComponentId: "chart-2",
        sourceComponentType: "chart",
        dimension: "region",
        value: "APAC",
        label: "Asia",
      });
      expect(callCount).toBe(1);
    });

    it("source component is not cross-filtered by its own selection", () => {
      let received = 0;
      api.subscribe("chart-1", ["region"], () => {
        received++;
      });

      api.crossFilter({
        sourceComponentId: "chart-1",
        sourceComponentType: "chart",
        dimension: "region",
        value: "APAC",
        label: "Asia",
      });

      expect(received).toBe(0);
    });
  });

  describe("drillDown / drillUp", () => {
    it("updates drill state on drillDown", () => {
      api.drillDown("chart-1", "year", "2026");

      const state = api.getDrillState("chart-1");
      expect(state?.currentDimension).toBe("year");
      expect(state?.currentValue).toBe("2026");
      expect(state?.parentPath).toEqual([]);
    });

    it("accumulates parent path on successive drillDown calls", () => {
      api.drillDown("chart-1", "year", "2026");
      api.drillDown("chart-1", "quarter", "Q1");

      const state = api.getDrillState("chart-1");
      expect(state?.currentDimension).toBe("quarter");
      expect(state?.currentValue).toBe("Q1");
      expect(state?.parentPath).toEqual([{ dimension: "year", value: "2026" }]);
    });

    it("drillUp restores previous drill level", () => {
      api.drillDown("chart-1", "year", "2026");
      api.drillDown("chart-1", "quarter", "Q1");

      api.drillUp("chart-1");

      const state = api.getDrillState("chart-1");
      expect(state?.currentDimension).toBe("year");
      expect(state?.currentValue).toBe("2026");
      expect(state?.parentPath).toEqual([]);
    });

    it("returns undefined for unknown component", () => {
      expect(api.getDrillState("unknown")).toBeUndefined();
    });
  });

  describe("drillThrough", () => {
    it("invokes onDrillThrough callback with target", () => {
      let captured: unknown = null;
      const api2 = createDataInteractionAPI(undefined, (target) => {
        captured = target;
      });

      api2.drillThrough("table-1", {
        pageId: "customer-detail",
        params: { customerId: "ABC" },
        label: "View Customer Detail",
      });

      expect(captured).toEqual({
        pageId: "customer-detail",
        params: { customerId: "ABC" },
        label: "View Customer Detail",
      });
    });

    it("does not throw when no onDrillThrough callback is set", () => {
      expect(() =>
        api.drillThrough("table-1", {
          pageId: "detail",
          params: {},
          label: "Detail",
        }),
      ).not.toThrow();
    });
  });

  describe("setFilter / clearFilter", () => {
    it("setFilter applies filter and notifies subscribers", () => {
      let received: unknown = null;
      api.subscribe("filter-1", ["region"], (params) => {
        received = params;
      });

      api.setFilter("filter-1", "region", "EMEA");

      expect(received).toEqual([{ key: "region", value: "EMEA", operator: "eq" }]);
    });

    it("clearFilter removes filter", () => {
      api.setFilter("filter-1", "region", "EMEA");
      api.setFilter("filter-1", "quarter", "Q1");

      api.clearFilter("filter-1");

      const filterState = api.getFilterState("filter-1");
      expect(filterState).toEqual([]);
    });

    it("getFilterState returns active filters for component", () => {
      api.setFilter("filter-1", "region", "EMEA");

      const state = api.getFilterState("filter-1");
      expect(state).toEqual([{ key: "region", value: "EMEA", operator: "eq" }]);
    });

    it("clearAllFilters resets all filters across all components", () => {
      api.setFilter("filter-1", "region", "EMEA");
      api.setFilter("filter-2", "quarter", "Q1");

      api.clearAllFilters();

      expect(api.getFilterState("filter-1")).toEqual([]);
      expect(api.getFilterState("filter-2")).toEqual([]);
    });
  });

  describe("async resolution pipeline", () => {
    it("API calls return synchronously without error", () => {
      const sel: SelectionEvent = {
        sourceComponentId: "chart-1",
        sourceComponentType: "chart",
        dimension: "region",
        value: "EMEA",
        label: "Europe",
      };

      expect(() => api.crossFilter(sel)).not.toThrow();
      expect(() => api.drillDown("chart-1", "year", "2026")).not.toThrow();
      expect(() => api.drillUp("chart-1")).not.toThrow();
      expect(() => api.setFilter("f1", "region", "x")).not.toThrow();
      expect(() => api.clearFilter("f1")).not.toThrow();
    });

    it("subscribe callback fires synchronously on crossFilter", () => {
      let fired = false;
      api.subscribe("table-1", ["region"], () => {
        fired = true;
      });

      api.crossFilter({
        sourceComponentId: "chart-1",
        sourceComponentType: "chart",
        dimension: "region",
        value: "EMEA",
        label: "Europe",
      });

      expect(fired).toBe(true);
    });
  });
});