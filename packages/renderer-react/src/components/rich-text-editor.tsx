import type { DocNode } from "@ai-native/core";
import type { SceneNode } from "@ai-native/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import type { RenderContext } from "../renderer.js";
import { useEditorCallbacks } from "../editor-callbacks.js";

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

  const isEditable =
    ctx.mode === "editor" && node.props?.editable !== false;

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link],
    content,
    editable: isEditable,
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
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div data-component="text" data-richtext="editor">
      <EditorContent editor={editor} />
    </div>
  );
}
