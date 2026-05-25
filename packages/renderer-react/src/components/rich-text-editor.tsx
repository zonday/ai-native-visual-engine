import type { DocNode, SceneNode } from "@ai-native/core";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEditorCallbacks } from "../editor-callbacks.js";
import type { RenderContext } from "../renderer.js";

export interface RichTextEditorProps {
  node: SceneNode;
  ctx: RenderContext;
}

export function RichTextEditor({ node, ctx }: RichTextEditorProps) {
  const { onContentChange } = useEditorCallbacks();

  const content = (node.props?.content ?? {
    type: "doc",
    content: [{ type: "paragraph" }],
  }) as DocNode;

  const isEditable = ctx.mode === "editor" && node.props?.editable !== false;
  const placeholder =
    (node.props?.placeholder as string | undefined) ?? undefined;

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link],
    content,
    editable: isEditable,
    editorProps: {
      attributes: {
        placeholder: placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => {
      if (!onContentChange) return;
      const json = editor.getJSON() as DocNode;
      onContentChange(node.id, json);
    },
  });

  if (ctx.mode === "runtime") {
    const html = editor?.getHTML() ?? "";
    return (
      <div
        data-component="text"
        data-richtext="static"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from Tiptap ProseMirror serializer is safe
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div data-component="text" data-richtext="editor">
      <style>
        {`.ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          float: left;
          height: 0;
        }`}
      </style>
      <EditorContent editor={editor} />
    </div>
  );
}
