import type { HistoryState, SceneGraph, VisualDocument } from "@ai-native/core";
import { useState } from "react";

export interface DebugPanelProps {
  doc: VisualDocument;
  scene: SceneGraph;
  history: HistoryState<{ type: string }>;
}

export function DebugPanel({ doc, scene, history }: DebugPanelProps) {
  const [tab, setTab] = useState<"doc" | "scene" | "history">("history");

  return (
    <div className="h-full flex flex-col bg-gray-50 text-xs font-mono">
      <div className="flex border-b border-slate-200 shrink-0">
        {(["history", "doc", "scene"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 px-2 py-1 text-xs uppercase tracking-wider ${
              tab === t
                ? "bg-white font-semibold border-b-2 border-blue-500"
                : "text-slate-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-2">
        {tab === "history" && (
          <div className="space-y-2">
            <div>
              <div className="font-semibold text-slate-600 mb-1">
                Undo Stack ({history.undoStack.length})
              </div>
              {history.undoStack.length === 0 && (
                <div className="text-slate-400">empty</div>
              )}
              {[...history.undoStack].reverse().map((entry) => (
                <div
                  key={entry.timestamp ?? entry.action.type}
                  className="text-[10px] text-slate-700"
                >
                  {(entry.actions ?? [entry.action])
                    .map((a: { type: string }) => a.type)
                    .join(", ")}
                </div>
              ))}
            </div>
            <div>
              <div className="font-semibold text-slate-600 mb-1">
                Redo Stack ({history.redoStack.length})
              </div>
              {history.redoStack.length === 0 && (
                <div className="text-slate-400">empty</div>
              )}
              {[...history.redoStack].reverse().map((entry) => (
                <div
                  key={entry.timestamp ?? entry.action.type}
                  className="text-[10px] text-slate-700"
                >
                  {(entry.actions ?? [entry.action])
                    .map((a: { type: string }) => a.type)
                    .join(", ")}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "doc" && (
          <pre className="text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(
              doc,
              (_key, val) => (typeof val === "function" ? undefined : val),
              2,
            )}
          </pre>
        )}
        {tab === "scene" && (
          <pre className="text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(
              scene,
              (_key, val) => (typeof val === "function" ? undefined : val),
              2,
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
