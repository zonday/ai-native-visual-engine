import mitt from "mitt";
import type { NodeId, SceneGraph } from "./types.js";

export type EngineEvents = {
  scene: SceneGraph;
  selection: NodeId[];
};

export class EventBus {
  private mitt = mitt<EngineEvents>();
  private timers = new Map<keyof EngineEvents, ReturnType<typeof setTimeout>>();
  private disposed = false;

  on<K extends keyof EngineEvents>(
    type: K,
    cb: (data: EngineEvents[K]) => void,
  ): () => void {
    this.mitt.on(type, cb as (data: EngineEvents[K]) => void);
    return () => this.mitt.off(type, cb as (data: EngineEvents[K]) => void);
  }

  off<K extends keyof EngineEvents>(
    type: K,
    cb: (data: EngineEvents[K]) => void,
  ): void {
    this.mitt.off(type, cb as (data: EngineEvents[K]) => void);
  }

  emit<K extends keyof EngineEvents>(type: K, data: EngineEvents[K]): void {
    const existing = this.timers.get(type);
    if (existing) clearTimeout(existing);
    this.timers.set(
      type,
      setTimeout(() => {
        if (this.disposed) return;
        this.mitt.emit(type, data);
        this.timers.delete(type);
      }),
    );
  }

  emitSync<K extends keyof EngineEvents>(type: K, data: EngineEvents[K]): void {
    this.mitt.emit(type, data);
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.mitt.all.clear();
  }
}
