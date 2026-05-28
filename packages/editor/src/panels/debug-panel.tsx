import type { SceneGraph, VisualDocument } from "@ai-native/core";
import { useState } from "react";

interface HistoryEntry {
  action: { type: string };
  actions?: { type: string }[];
  inverseAction?: { type: string };
  inverseActions?: { type: string }[];
  timestamp?: number;
}

interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

export interface DebugPanelProps {
  doc: VisualDocument;
  scene: SceneGraph;
  runtimeHistory: HistoryState;
  documentHistory: HistoryState;
}

export function DebugPanel({
  doc,
  scene,
  runtimeHistory,
  documentHistory,
}: DebugPanelProps) {
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
                Runtime Undo Stack ({runtimeHistory.undoStack.length})
              </div>
              {runtimeHistory.undoStack.length === 0 && (
                <div className="text-slate-400">empty</div>
              )}
              {[...runtimeHistory.undoStack].reverse().map((entry) => (
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
                Runtime Redo Stack ({runtimeHistory.redoStack.length})
              </div>
              {runtimeHistory.redoStack.length === 0 && (
                <div className="text-slate-400">empty</div>
              )}
              {[...runtimeHistory.redoStack].reverse().map((entry) => (
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
                Document Undo Stack ({documentHistory.undoStack.length})
              </div>
              {documentHistory.undoStack.length === 0 && (
                <div className="text-slate-400">empty</div>
              )}
              {[...documentHistory.undoStack].reverse().map((entry) => (
                <div
                  key={"du-" + (entry.timestamp ?? entry.action.type)}
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
                Document Redo Stack ({documentHistory.redoStack.length})
              </div>
              {documentHistory.redoStack.length === 0 && (
                <div className="text-slate-400">empty</div>
              )}
              {[...documentHistory.redoStack].reverse().map((entry) => (
                <div
                  key={"dr-" + (entry.timestamp ?? entry.action.type)}
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
