import { describe, it, expect } from "vitest";
import { markdownToDoc, docToMarkdown } from "../src/markdown-interop.js";
import { validateRichText } from "../src/rich-text.js";
import type { BlockNode } from "../src/rich-text.js";

function blockAt(content: BlockNode[], index: number): BlockNode {
  const block = content[index];
  if (!block) throw new Error(`Expected block at index ${index}`);
  return block;
}

describe("markdownToDoc", () => {
  it("converts plain text to paragraph", () => {
    const doc = markdownToDoc("Hello world");
    expect(validateRichText(doc)).toBe(true);
    expect(doc.content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello world" }],
      },
    ]);
  });

  it("converts headings", () => {
    const doc = markdownToDoc("# H1\n## H2\n### H3");
    expect(validateRichText(doc)).toBe(true);
    expect(doc.content).toHaveLength(3);
    const h1 = blockAt(doc.content, 0);
    const h2 = blockAt(doc.content, 1);
    const h3 = blockAt(doc.content, 2);
    expect(h1.type).toBe("heading");
    expect((h1 as { attrs: { level: number } }).attrs.level).toBe(1);
    expect(h2.type).toBe("heading");
    expect((h2 as { attrs: { level: number } }).attrs.level).toBe(2);
    expect(h3.type).toBe("heading");
    expect((h3 as { attrs: { level: number } }).attrs.level).toBe(3);
  });

  it("converts bold and italic", () => {
    const doc = markdownToDoc("This is **bold** and *italic*");
    expect(validateRichText(doc)).toBe(true);
    const first = blockAt(doc.content, 0);
    const content = (first as { content?: unknown[] }).content ?? [];
    expect(content).toHaveLength(4);
  });

  it("converts strikethrough and code", () => {
    const doc = markdownToDoc("~~strike~~ `code`");
    expect(validateRichText(doc)).toBe(true);
  });

  it("converts links", () => {
    const doc = markdownToDoc("[GitHub](https://github.com)");
    expect(validateRichText(doc)).toBe(true);
    const first = blockAt(doc.content, 0);
    const content = (
      first as {
        content?: Array<{
          marks?: Array<{ type: string; attrs?: { href: string } }>;
        }>;
      }
    ).content?.[0];
    expect(content?.marks?.[0]?.type).toBe("link");
    expect(content?.marks?.[0]?.attrs?.href).toBe("https://github.com");
  });

  it("converts bullet lists", () => {
    const doc = markdownToDoc("- Item 1\n- Item 2");
    expect(validateRichText(doc)).toBe(true);
    const first = blockAt(doc.content, 0);
    expect(first.type).toBe("bulletList");
    expect((first as { content?: unknown[] }).content).toHaveLength(2);
  });

  it("converts ordered lists", () => {
    const doc = markdownToDoc("1. First\n2. Second");
    expect(validateRichText(doc)).toBe(true);
    expect(blockAt(doc.content, 0).type).toBe("orderedList");
  });

  it("converts blockquotes", () => {
    const doc = markdownToDoc("> quoted text");
    expect(validateRichText(doc)).toBe(true);
    expect(blockAt(doc.content, 0).type).toBe("blockquote");
  });

  it("converts code blocks", () => {
    const doc = markdownToDoc("```\nconst x = 1;\n```");
    expect(validateRichText(doc)).toBe(true);
    expect(blockAt(doc.content, 0).type).toBe("codeBlock");
  });

  it("skips blank lines", () => {
    const doc = markdownToDoc("A\n\nB");
    expect(validateRichText(doc)).toBe(true);
    expect(doc.content).toHaveLength(2);
  });

  it("returns empty doc for empty input", () => {
    const doc = markdownToDoc("");
    expect(validateRichText(doc)).toBe(true);
    expect(doc.content).toEqual([{ type: "paragraph" }]);
  });
});

describe("docToMarkdown", () => {
  it("serializes a paragraph", () => {
    const doc = markdownToDoc("Hello world");
    expect(docToMarkdown(doc)).toBe("Hello world");
  });

  it("serializes headings", () => {
    const doc = markdownToDoc("# H1\n## H2");
    expect(docToMarkdown(doc)).toBe("# H1\n## H2");
  });

  it("serializes bold and italic", () => {
    const doc = markdownToDoc("**bold** *italic*");
    expect(docToMarkdown(doc)).toBe("**bold** *italic*");
  });

  it("serializes code", () => {
    const doc = markdownToDoc("`inline`");
    expect(docToMarkdown(doc)).toBe("`inline`");
  });

  it("serializes links", () => {
    const doc = markdownToDoc("[link](https://x.com)");
    expect(docToMarkdown(doc)).toBe("[link](https://x.com)");
  });

  it("serializes bullet list", () => {
    const doc = markdownToDoc("- A\n- B");
    expect(docToMarkdown(doc)).toBe("- A\n- B");
  });

  it("serializes blockquote", () => {
    const doc = markdownToDoc("> quote");
    expect(docToMarkdown(doc)).toBe("> quote");
  });

  it("serializes code block", () => {
    const doc = markdownToDoc("```\ncode\n```");
    expect(docToMarkdown(doc)).toBe("```\ncode\n```");
  });

  it("round-trips markdown through doc and back is lossy but structure-preserving", () => {
    const input = "# Title\n\nHello **world**\n\n- one\n- two";
    const doc = markdownToDoc(input);
    const output = docToMarkdown(doc);
    // Verify key structures survive round-trip
    expect(output).toContain("# Title");
    expect(output).toContain("**world**");
    expect(output).toContain("- one");
    expect(output).toContain("- two");
  });
});
