import { z } from "zod";

export interface DocNode {
  type: "doc";
  content: BlockNode[];
}

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | BlockquoteNode
  | CodeBlockNode;

export interface ParagraphNode {
  type: "paragraph";
  content?: InlineNode[];
}

export interface HeadingNode {
  type: "heading";
  attrs: { level: 1 | 2 | 3 };
  content?: InlineNode[];
}

export interface BulletListNode {
  type: "bulletList";
  content?: ListItemNode[];
}

export interface OrderedListNode {
  type: "orderedList";
  content?: ListItemNode[];
}

export interface BlockquoteNode {
  type: "blockquote";
  content?: BlockNode[];
}

export interface CodeBlockNode {
  type: "codeBlock";
  content?: TextNode[];
}

export interface ListItemNode {
  type: "listItem";
  content: (BlockNode | InlineNode)[];
}

export type InlineNode = TextNode | HardBreakNode;

export interface TextNode {
  type: "text";
  text: string;
  marks?: MarkNode[];
}

export interface HardBreakNode {
  type: "hardBreak";
}

export type MarkNode =
  | BoldMark
  | ItalicMark
  | UnderlineMark
  | StrikeMark
  | CodeMark
  | LinkMark;

export interface BoldMark {
  type: "bold";
}

export interface ItalicMark {
  type: "italic";
}

export interface UnderlineMark {
  type: "underline";
}

export interface StrikeMark {
  type: "strike";
}

export interface CodeMark {
  type: "code";
}

export interface LinkMark {
  type: "link";
  attrs: { href: string; title?: string };
}

export const EMPTY_DOC: DocNode = Object.freeze({
  type: "doc",
  content: Object.freeze([Object.freeze({ type: "paragraph" })]),
}) as DocNode;

export function extractPlainText(doc: DocNode): string {
  const parts: string[] = [];
  walkTextNodes(doc, parts, 0);
  return parts.join("");
}

function walkTextNodes(
  node: unknown,
  parts: string[],
  depth: number,
): void {
  if (depth > 100) return;
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") {
    parts.push(n.text);
    return;
  }
  if (n.type === "hardBreak") {
    parts.push("\n");
    return;
  }
  const content = Array.isArray(n.content) ? n.content : [];
  for (const child of content) {
    walkTextNodes(child, parts, depth + 1);
  }
}

export function plainTextToDoc(text: string): DocNode {
  const lines = text.split("\n");
  const content: BlockNode[] = lines.map((line) => {
    if (line === "") {
      return { type: "paragraph" };
    }
    return { type: "paragraph", content: [{ type: "text", text: line }] };
  });
  return { type: "doc", content };
}

const textNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  marks: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("bold") }),
        z.object({ type: z.literal("italic") }),
        z.object({ type: z.literal("underline") }),
        z.object({ type: z.literal("strike") }),
        z.object({ type: z.literal("code") }),
        z.object({
          type: z.literal("link"),
          attrs: z.object({
            href: z
              .string()
              .refine(
                (u) =>
                  u.startsWith("https://") ||
                  u.startsWith("http://") ||
                  u.startsWith("/") ||
                  u.startsWith("#") ||
                  u.startsWith("mailto:"),
                {
                  message:
                    "Only http/https/relative/mailto/anchor URLs allowed",
                },
              ),
            title: z.string().optional(),
          }),
        }),
      ]),
    )
    .optional(),
});

const blockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("paragraph"),
      content: z.array(inlineNodeSchema).optional(),
    }),
    z.object({
      type: z.literal("heading"),
      attrs: z.object({
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      }),
      content: z.array(inlineNodeSchema).optional(),
    }),
    z.object({
      type: z.literal("bulletList"),
      content: z.array(listItemNodeSchema).optional(),
    }),
    z.object({
      type: z.literal("orderedList"),
      content: z.array(listItemNodeSchema).optional(),
    }),
    z.object({
      type: z.literal("blockquote"),
      content: z.array(z.lazy(() => blockNodeSchema)).optional(),
    }),
    z.object({
      type: z.literal("codeBlock"),
      content: z.array(textNodeSchema).optional(),
    }),
  ]),
);

const listItemNodeSchema: z.ZodType<ListItemNode> = z.lazy(() =>
  z.object({
    type: z.literal("listItem"),
    content: z.array(z.union([blockNodeSchema, inlineNodeSchema])),
  }),
);

const inlineNodeSchema: z.ZodType<InlineNode> = z.discriminatedUnion("type", [
  textNodeSchema,
  z.object({ type: z.literal("hardBreak") }),
]);

const docNodeSchema: z.ZodType<DocNode> = z.object({
  type: z.literal("doc"),
  content: z.array(blockNodeSchema).max(10000),
});

export function validateRichText(doc: unknown): doc is DocNode {
  const result = docNodeSchema.safeParse(doc);
  return result.success;
}
