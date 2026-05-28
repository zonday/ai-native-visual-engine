import type {
  ComponentPlugin,
  InteractionEngine,
  RuntimeAction,
  SceneNode,
  SelectorRegistry,
  VisualDocument,
} from "@ai-native/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { DestructiveButton } from "../components/ui/button.js";
import { useInteraction } from "../hooks/use-interaction.js";
import { useEditorStore } from "../store.js";

export interface InspectorProps {
  document: VisualDocument;
  selectorRegistry?: SelectorRegistry;
  interactionEngine?: InteractionEngine;
  onDispatchRuntime?: (action: RuntimeAction) => void;
  plugins?: ComponentPlugin[];
}

function DebouncedField({
  value,
  onChange,
  type = "text",
}: {
  value: string | number;
  onChange: (v: string | number) => void;
  type?: "text" | "number";
}) {
  const [local, setLocal] = useState(value);
  const valueRef = useRef(value);

  // Sync external changes (undo, redo, etc.)
  useEffect(() => {
    if (value !== valueRef.current) {
      valueRef.current = value;
      setLocal(value);
    }
  }, [value]);

  // Debounce dispatch
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(t);
  }, [local, onChange, value]);

  return (
    <input
      type={type}
      value={local}
      onChange={(e) =>
        setLocal(type === "number" ? Number(e.target.value) : e.target.value)
      }
      className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white"
    />
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-slate-500 text-xs">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h4 className="text-xs font-semibold mt-3 mb-1.5 uppercase tracking-wider text-slate-600">
      {title}
    </h4>
  );
}

export function Inspector({
  document,
  selectorRegistry,
  interactionEngine,
  onDispatchRuntime,
  plugins,
}: InspectorProps) {
  const { nodeIds } = useInteraction(interactionEngine);
  const activePageId = useEditorStore((s) => s.activePageId);

  const activePage = activePageId
    ? document.pages.find((p) => p.id === activePageId)
    : undefined;

  const selectedId = nodeIds[0];

  let selectedNode: SceneNode | undefined;
  if (selectedId && activePage) {
    selectedNode = selectorRegistry?.getNode(selectedId);
  }

  const plugin = selectedNode
    ? plugins?.find((p) => p.type === selectedNode.type)
    : undefined;

  const patchProp = useCallback(
    (key: string, value: unknown) => {
      if (!selectedId || !onDispatchRuntime) return;
      onDispatchRuntime({
        type: "update-props",
        nodeId: selectedId,
        props: { [key]: value },
      });
    },
    [selectedId, onDispatchRuntime],
  );

  const patchStyle = useCallback(
    (key: string, value: unknown) => {
      if (!selectedId || !onDispatchRuntime) return;
      onDispatchRuntime({
        type: "update-style",
        nodeId: selectedId,
        style: { [key]: value },
      });
    },
    [selectedId, onDispatchRuntime],
  );

  const patchLayout = useCallback(
    (key: string, value: unknown) => {
      if (!selectedId || !onDispatchRuntime) return;
      onDispatchRuntime({
        type: "update-layout",
        nodeId: selectedId,
        layout: { [key]: value },
      });
    },
    [selectedId, onDispatchRuntime],
  );

  const handleDelete = useCallback(() => {
    if (!selectedId || !onDispatchRuntime) return;
    onDispatchRuntime({
      type: "remove-node",
      nodeId: selectedId,
    });
    interactionEngine?.clearSelection();
  }, [selectedId, onDispatchRuntime, interactionEngine]);

  if (!selectedId) {
    if (!activePage) {
      return (
        <div className="p-3">
          <p className="text-xs text-slate-400">No selection</p>
        </div>
      );
    }
    return (
      <div className="p-3">
        <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider">
          Page
        </h3>
        <div className="text-xs space-y-2">
          <div>
            <strong>Name:</strong> {activePage.name}
          </div>
          <div>
            <strong>ID:</strong> {activePage.id}
          </div>
          <div>
            <strong>Scene:</strong> {activePage.sceneId}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="p-3">
        <p className="text-xs text-slate-400">Node not found</p>
      </div>
    );
  }

  const nodeProps = selectedNode.props ?? {};
  const nodeStyle = (selectedNode.style ?? {}) as Record<string, unknown>;
  const nodeLayout = (selectedNode.layout ?? {}) as Record<string, unknown>;
  const layoutMode =
    typeof nodeLayout.mode === "string" ? nodeLayout.mode : undefined;
  const parentIsGrid =
    selectedId &&
    selectorRegistry?.getParent(selectedId)?.layout?.mode === "grid";

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider m-0">
          Inspector
        </h3>
        <DestructiveButton type="button" onClick={handleDelete}>
          Delete
        </DestructiveButton>
      </div>

      <div className="text-xs space-y-1 pb-2 border-b border-slate-200">
        <FieldRow label="ID">
          <span className="text-slate-500">{selectedNode.id}</span>
        </FieldRow>
        <FieldRow label="Type">
          <span className="text-slate-500">{selectedNode.type}</span>
        </FieldRow>
        <FieldRow label="Name">
          <DebouncedField
            value={(nodeProps.name as string) ?? ""}
            onChange={(v) => patchProp("name", v)}
          />
        </FieldRow>
      </div>

      {/* Properties Section */}
      {plugin && plugin.meta.props.length > 0 && (
        <>
          <SectionHeader title="Properties" />
          <div className="text-xs space-y-1.5">
            {plugin.meta.props.map((prop) => {
              const val = nodeProps[prop.key] ?? prop.default ?? "";
              if (prop.type === "string") {
                return (
                  <FieldRow key={prop.key} label={prop.key}>
                    <DebouncedField
                      value={String(val)}
                      onChange={(v) => patchProp(prop.key, v)}
                    />
                  </FieldRow>
                );
              }
              if (prop.type === "number") {
                return (
                  <FieldRow key={prop.key} label={prop.key}>
                    <DebouncedField
                      type="number"
                      value={Number(val)}
                      onChange={(v) => patchProp(prop.key, v)}
                    />
                  </FieldRow>
                );
              }
              if (prop.type === "boolean") {
                return (
                  <FieldRow key={prop.key} label={prop.key}>
                    <input
                      type="checkbox"
                      defaultChecked={Boolean(val)}
                      onChange={(e) => patchProp(prop.key, e.target.checked)}
                      className="mt-1"
                    />
                  </FieldRow>
                );
              }
              return null;
            })}
          </div>
        </>
      )}

      {/* Style Section */}
      <SectionHeader title="Style" />
      <div className="text-xs space-y-1.5">
        <FieldRow label="Opacity">
          <DebouncedField
            type="number"
            value={(nodeStyle.opacity as number) ?? 1}
            onChange={(v) => patchStyle("opacity", v)}
          />
        </FieldRow>
        <FieldRow label="Border radius">
          <DebouncedField
            type="number"
            value={(nodeStyle.borderRadius as number) ?? 0}
            onChange={(v) => patchStyle("borderRadius", v)}
          />
        </FieldRow>
        <FieldRow label="Font size">
          <DebouncedField
            type="number"
            value={(nodeStyle.fontSize as number) ?? 14}
            onChange={(v) => patchStyle("fontSize", v)}
          />
        </FieldRow>
        <FieldRow label="Background">
          <DebouncedField
            value={(nodeStyle.backgroundColor as string) ?? ""}
            onChange={(v) => patchStyle("backgroundColor", v)}
          />
        </FieldRow>
        <FieldRow label="Color">
          <DebouncedField
            value={(nodeStyle.color as string) ?? ""}
            onChange={(v) => patchStyle("color", v)}
          />
        </FieldRow>
      </div>

      {/* Layout Section */}
      <SectionHeader title="Layout" />
      <div className="text-xs space-y-1.5">
        <FieldRow label="Mode">
          <select
            value={layoutMode ?? ""}
            onChange={(e) => patchLayout("mode", e.target.value || undefined)}
            className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white"
          >
            <option value="">relative</option>
            <option value="absolute">absolute</option>
            <option value="flex">flex</option>
            <option value="grid">grid</option>
            {parentIsGrid || layoutMode === "grid-item" ? (
              <option value="grid-item">grid-item</option>
            ) : null}
          </select>
        </FieldRow>
        {layoutMode === "absolute" ? (
          <>
            <FieldRow label="X">
              <DebouncedField
                type="number"
                value={(nodeLayout.x as number) ?? 0}
                onChange={(v) => patchLayout("x", v)}
              />
            </FieldRow>
            <FieldRow label="Y">
              <DebouncedField
                type="number"
                value={(nodeLayout.y as number) ?? 0}
                onChange={(v) => patchLayout("y", v)}
              />
            </FieldRow>
            <FieldRow label="Width">
              <DebouncedField
                type="number"
                value={(nodeLayout.width as number) ?? 0}
                onChange={(v) => patchLayout("width", v)}
              />
            </FieldRow>
            <FieldRow label="Height">
              <DebouncedField
                type="number"
                value={(nodeLayout.height as number) ?? 0}
                onChange={(v) => patchLayout("height", v)}
              />
            </FieldRow>
          </>
        ) : layoutMode === "flex" ? (
          <>
            <FieldRow label="Direction">
              <select
                value={(nodeLayout.direction as string) ?? "row"}
                onChange={(e) => patchLayout("direction", e.target.value)}
                className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white"
              >
                <option value="row">row</option>
                <option value="column">column</option>
                <option value="row-reverse">row-reverse</option>
                <option value="column-reverse">column-reverse</option>
              </select>
            </FieldRow>
            <FieldRow label="Gap">
              <DebouncedField
                type="number"
                value={(nodeLayout.gap as number) ?? 0}
                onChange={(v) => patchLayout("gap", v)}
              />
            </FieldRow>
            <FieldRow label="Align">
              <select
                value={(nodeLayout.align as string) ?? "stretch"}
                onChange={(e) => patchLayout("align", e.target.value)}
                className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white"
              >
                <option value="stretch">stretch</option>
                <option value="flex-start">flex-start</option>
                <option value="center">center</option>
                <option value="flex-end">flex-end</option>
              </select>
            </FieldRow>
            <FieldRow label="Justify">
              <select
                value={(nodeLayout.justify as string) ?? "flex-start"}
                onChange={(e) => patchLayout("justify", e.target.value)}
                className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white"
              >
                <option value="flex-start">flex-start</option>
                <option value="center">center</option>
                <option value="flex-end">flex-end</option>
                <option value="space-between">space-between</option>
              </select>
            </FieldRow>
            <FieldRow label="Width">
              <DebouncedField
                type="number"
                value={(nodeLayout.width as number) ?? 0}
                onChange={(v) => patchLayout("width", v)}
              />
            </FieldRow>
            <FieldRow label="Height">
              <DebouncedField
                type="number"
                value={(nodeLayout.height as number) ?? 0}
                onChange={(v) => patchLayout("height", v)}
              />
            </FieldRow>
          </>
        ) : layoutMode === "grid" ? (
          <>
            <FieldRow label="Columns">
              <DebouncedField
                type="number"
                value={(nodeLayout.columns as number) ?? 3}
                onChange={(v) => patchLayout("columns", v)}
              />
            </FieldRow>
            <FieldRow label="Gap">
              <DebouncedField
                type="number"
                value={(nodeLayout.gap as number) ?? 8}
                onChange={(v) => patchLayout("gap", v)}
              />
            </FieldRow>
            <FieldRow label="Width">
              <DebouncedField
                type="number"
                value={(nodeLayout.width as number) ?? 0}
                onChange={(v) => patchLayout("width", v)}
              />
            </FieldRow>
            <FieldRow label="Height">
              <DebouncedField
                type="number"
                value={(nodeLayout.height as number) ?? 0}
                onChange={(v) => patchLayout("height", v)}
              />
            </FieldRow>
          </>
        ) : layoutMode === "grid-item" ? (
          <>
            <FieldRow label="Column">
              <DebouncedField
                type="number"
                value={(nodeLayout.x as number) ?? 0}
                onChange={(v) => patchLayout("x", v)}
              />
            </FieldRow>
            <FieldRow label="Row">
              <DebouncedField
                type="number"
                value={(nodeLayout.y as number) ?? 0}
                onChange={(v) => patchLayout("y", v)}
              />
            </FieldRow>
            <FieldRow label="Span W">
              <DebouncedField
                type="number"
                value={(nodeLayout.w as number) ?? 1}
                onChange={(v) => patchLayout("w", v)}
              />
            </FieldRow>
            <FieldRow label="Span H">
              <DebouncedField
                type="number"
                value={(nodeLayout.h as number) ?? 1}
                onChange={(v) => patchLayout("h", v)}
              />
            </FieldRow>
            <FieldRow label="Width">
              <DebouncedField
                type="number"
                value={(nodeLayout.width as number) ?? 0}
                onChange={(v) => patchLayout("width", v)}
              />
            </FieldRow>
            <FieldRow label="Height">
              <DebouncedField
                type="number"
                value={(nodeLayout.height as number) ?? 0}
                onChange={(v) => patchLayout("height", v)}
              />
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="X">
              <DebouncedField
                type="number"
                value={(nodeLayout.x as number) ?? 0}
                onChange={(v) => patchLayout("x", v)}
              />
            </FieldRow>
            <FieldRow label="Y">
              <DebouncedField
                type="number"
                value={(nodeLayout.y as number) ?? 0}
                onChange={(v) => patchLayout("y", v)}
              />
            </FieldRow>
            <FieldRow label="Width">
              <DebouncedField
                type="number"
                value={(nodeLayout.width as number) ?? 0}
                onChange={(v) => patchLayout("width", v)}
              />
            </FieldRow>
            <FieldRow label="Height">
              <DebouncedField
                type="number"
                value={(nodeLayout.height as number) ?? 0}
                onChange={(v) => patchLayout("height", v)}
              />
            </FieldRow>
          </>
        )}
      </div>
    </div>
  );
}
