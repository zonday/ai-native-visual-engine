import type { DocNode, SceneNode } from "@ai-native/core";
import { extractPlainText } from "@ai-native/core";
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
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        validate: (href) => /^https?:\/\//.test(href),
      }),
    ],
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
    const html = editor?.getHTML() ?? extractPlainText(content);
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
      <EditorContent editor={editor} />
      {!editor && <span>{extractPlainText(content)}</span>}
    </div>
  );
}
