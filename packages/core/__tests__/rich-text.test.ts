import { describe, it, expect } from "vitest";
import {
  extractPlainText,
  plainTextToDoc,
  validateRichText,
  EMPTY_DOC,
} from "../src/rich-text.js";
import type { DocNode } from "../src/rich-text.js";

describe("EMPTY_DOC", () => {
  it("has type doc with a single empty paragraph", () => {
    expect(EMPTY_DOC).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("is a valid DocNode", () => {
    expect(validateRichText(EMPTY_DOC)).toBe(true);
  });
});

describe("extractPlainText", () => {
  it("extracts text from a single paragraph", () => {
    const doc: DocNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Hello world");
  });

  it("concatenates text from multiple paragraphs", () => {
    const doc: DocNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("FirstSecond");
  });

  it("handles headings", () => {
    const doc: DocNode = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("TitleBody");
  });

  it("returns empty string for empty document", () => {
    expect(extractPlainText(EMPTY_DOC)).toBe("");
  });

  it("extracts text from blockquotes and lists", () => {
    const doc: DocNode = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 2" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("Item 1Item 2");
  });
});

describe("plainTextToDoc", () => {
  it("converts a single line to a paragraph", () => {
    const doc = plainTextToDoc("Hello world");
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    });
  });

  it("converts multiple lines to multiple paragraphs", () => {
    const doc = plainTextToDoc("Line 1\nLine 2\nLine 3");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Line 1" }],
    });
    expect(doc.content[2]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Line 3" }],
    });
  });

  it("creates empty paragraphs for blank lines", () => {
    const doc = plainTextToDoc("A\n\nB");
    expect(doc.content).toHaveLength(3);
    expect(doc.content[1]).toEqual({ type: "paragraph" });
  });

  it("returns empty doc for empty string", () => {
    const doc = plainTextToDoc("");
    expect(doc.content).toEqual([{ type: "paragraph" }]);
  });
});

describe("validateRichText", () => {
  it("accepts a valid single-paragraph doc", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Valid" }],
        },
      ],
    };
    expect(validateRichText(doc)).toBe(true);
  });

  it("accepts a doc with headings", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H1" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H2" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "H3" }] },
      ],
    };
    expect(validateRichText(doc)).toBe(true);
  });

  it("accepts a doc with inline marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://x.com" } }] },
          ],
        },
      ],
    };
    expect(validateRichText(doc)).toBe(true);
  });

  it("rejects missing type field", () => {
    expect(validateRichText({ content: [] })).toBe(false);
  });

  it("rejects null", () => {
    expect(validateRichText(null)).toBe(false);
  });

  it("rejects doc with invalid block type", () => {
    expect(
      validateRichText({
        type: "doc",
        content: [{ type: "unknown", content: [] }],
      }),
    ).toBe(false);
  });

  it("rejects heading with invalid level", () => {
    expect(
      validateRichText({
        type: "doc",
        content: [{ type: "heading", attrs: { level: 4 }, content: [] }],
      }),
    ).toBe(false);
  });

  it("rejects non-array content", () => {
    expect(
      validateRichText({
        type: "doc",
        content: "not-an-array",
      }),
    ).toBe(false);
  });

  it("accepts https href in link mark", () => {
    expect(
      validateRichText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "link",
                marks: [
                  { type: "link", attrs: { href: "https://example.com" } },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it("rejects javascript: href in link mark", () => {
    expect(
      validateRichText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "xss",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it("accepts relative path and mailto hrefs", () => {
    expect(
      validateRichText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "a", marks: [{ type: "link", attrs: { href: "/path" } }] },
              { type: "text", text: "b", marks: [{ type: "link", attrs: { href: "#anchor" } }] },
              { type: "text", text: "c", marks: [{ type: "link", attrs: { href: "mailto:x@y.com" } }] },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
