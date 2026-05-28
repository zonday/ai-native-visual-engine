export class DependencyGraph {
  private forward = new Map<string, Set<string>>();
  private reverse = new Map<string, Set<string>>();

  addDependency(source: string, dependent: string): void {
    if (!this.forward.has(source)) {
      this.forward.set(source, new Set());
    }
    this.forward.get(source)!.add(dependent);

    if (!this.reverse.has(dependent)) {
      this.reverse.set(dependent, new Set());
    }
    this.reverse.get(dependent)!.add(source);
  }

  getDependents(source: string): Set<string> {
    return this.forward.get(source) ?? new Set();
  }

  getSources(dependent: string): Set<string> {
    return this.reverse.get(dependent) ?? new Set();
  }

  removeDependent(key: string): void {
    const sources = this.reverse.get(key);
    if (!sources) return;
    for (const source of sources) {
      this.forward.get(source)?.delete(key);
      if (this.forward.get(source)?.size === 0) {
        this.forward.delete(source);
      }
    }
    this.reverse.delete(key);
  }

  getTransitiveAffected(sourceKeys: string[]): Set<string> {
    const sourceSet = new Set(sourceKeys);
    const affected = new Set<string>();
    const queue = [...sourceKeys];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const dependents = this.forward.get(current);
      if (!dependents) continue;

      for (const dep of dependents) {
        if (!sourceSet.has(dep) && !affected.has(dep)) {
          affected.add(dep);
          queue.push(dep);
        }
      }
    }

    return affected;
  }

  hasDependencies(): boolean {
    return this.forward.size > 0;
  }

  clear(): void {
    this.forward.clear();
    this.reverse.clear();
  }
}
