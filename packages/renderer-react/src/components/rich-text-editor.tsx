import type { DocNode, SceneNode } from "@ai-native/core";
import { extractPlainText } from "@ai-native/core";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useMemo } from "react";
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

  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        validate: (href) => /^https?:\/\//.test(href),
      }),
    ],
    [],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        placeholder: placeholder ?? "",
      },
    }),
    [placeholder],
  );

  const onUpdate = useCallback(
    (props: { editor: Editor }) => {
      if (!onContentChange) return;
      const json = props.editor.getJSON() as DocNode;
      onContentChange(node.id, json);
    },
    [node.id, onContentChange],
  );

  const editor = useEditor({
    extensions,
    content,
    editable: isEditable,
    editorProps,
    onUpdate,
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
    <div data-component="text" data-richtext="editor" className="min-h-[1.5em]">
      <EditorContent editor={editor} />
      {!editor && <span>{extractPlainText(content)}</span>}
    </div>
  );
}
