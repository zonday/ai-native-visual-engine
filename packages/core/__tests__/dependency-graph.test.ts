import { describe, expect, it } from "vitest";
import { DependencyGraph } from "../src/deps/dependency-graph.js";

describe("DependencyGraph", () => {
  it("starts empty", () => {
    const g = new DependencyGraph();
    expect(g.hasDependencies()).toBe(false);
  });

  it("adds a single dependency edge", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    expect(g.getDependents("source:a")).toEqual(new Set(["dependent:x"]));
    expect(g.getSources("dependent:x")).toEqual(new Set(["source:a"]));
  });

  it("supports multiple dependents from one source", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.addDependency("source:a", "dependent:y");
    expect(g.getDependents("source:a")).toEqual(
      new Set(["dependent:x", "dependent:y"]),
    );
  });

  it("supports multiple sources for one dependent", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.addDependency("source:b", "dependent:x");
    expect(g.getSources("dependent:x")).toEqual(
      new Set(["source:a", "source:b"]),
    );
  });

  it("returns empty set for unknown source", () => {
    const g = new DependencyGraph();
    expect(g.getDependents("unknown")).toEqual(new Set());
  });

  it("returns empty set for unknown dependent", () => {
    const g = new DependencyGraph();
    expect(g.getSources("unknown")).toEqual(new Set());
  });

  it("removes a dependent and its reverse edges", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.addDependency("source:b", "dependent:x");
    g.addDependency("source:b", "dependent:y");
    g.removeDependent("dependent:x");
    expect(g.getDependents("source:a")).toEqual(new Set());
    expect(g.getDependents("source:b")).toEqual(new Set(["dependent:y"]));
    expect(g.getSources("dependent:x")).toEqual(new Set());
  });

  it("finds direct transitive affected", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.addDependency("source:a", "dependent:y");
    const affected = g.getTransitiveAffected(["source:a"]);
    expect(affected).toEqual(new Set(["dependent:x", "dependent:y"]));
  });

  it("finds multi-hop transitive affected", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.addDependency("dependent:x", "dependent:y");
    g.addDependency("dependent:y", "dependent:z");
    const affected = g.getTransitiveAffected(["source:a"]);
    expect(affected).toEqual(
      new Set(["dependent:x", "dependent:y", "dependent:z"]),
    );
  });

  it("handles diamond-shaped dependency graph", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.addDependency("source:a", "dependent:y");
    g.addDependency("dependent:x", "dependent:z");
    g.addDependency("dependent:y", "dependent:z");
    const affected = g.getTransitiveAffected(["source:a"]);
    expect(affected).toEqual(
      new Set(["dependent:x", "dependent:y", "dependent:z"]),
    );
  });

  it("does not revisit nodes in transitive walk", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.addDependency("dependent:x", "source:a");
    const affected = g.getTransitiveAffected(["source:a"]);
    expect(affected).toEqual(new Set(["dependent:x"]));
  });

  it("clears all edges", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.clear();
    expect(g.hasDependencies()).toBe(false);
    expect(g.getDependents("source:a")).toEqual(new Set());
  });

  it("hasDependencies returns false after removeDependent of last edge", () => {
    const g = new DependencyGraph();
    g.addDependency("source:a", "dependent:x");
    g.removeDependent("dependent:x");
    expect(g.hasDependencies()).toBe(false);
  });
});
