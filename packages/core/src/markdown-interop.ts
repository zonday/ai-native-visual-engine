import type {
  BlockNode,
  DocNode,
  InlineNode,
  ListItemNode,
} from "./rich-text.js";

function parseInline(text: string): InlineNode[] {
  if (text.length === 0) return [];
  const nodes: InlineNode[] = [];
  let i = 0;
  let plain = "";

  function flush() {
    if (plain) {
      nodes.push({ type: "text", text: plain });
      plain = "";
    }
  }

  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\" && i + 1 < text.length) {
      plain += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flush();
        nodes.push({
          type: "text",
          text: text.slice(i + 2, end),
          marks: [{ type: "bold" }],
        });
        i = end + 2;
        continue;
      }
    }

    if (ch === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        flush();
        nodes.push({
          type: "text",
          text: text.slice(i + 1, end),
          marks: [{ type: "italic" }],
        });
        i = end + 1;
        continue;
      }
    }

    if (ch === "~" && text[i + 1] === "~") {
      const end = text.indexOf("~~", i + 2);
      if (end !== -1) {
        flush();
        nodes.push({
          type: "text",
          text: text.slice(i + 2, end),
          marks: [{ type: "strike" }],
        });
        i = end + 2;
        continue;
      }
    }

    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        nodes.push({
          type: "text",
          text: text.slice(i + 1, end),
          marks: [{ type: "code" }],
        });
        i = end + 1;
        continue;
      }
    }

    if (ch === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          flush();
          nodes.push({
            type: "text",
            text: text.slice(i + 1, closeBracket),
            marks: [
              {
                type: "link",
                attrs: {
                  href: text.slice(closeBracket + 2, closeParen),
                },
              },
            ],
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    plain += ch;
    i++;
  }
  flush();
  return nodes;
}

export function markdownToDoc(md: string): DocNode {
  const lines = md.split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const h3 = /^### (.+)/.exec(line);
    if (h3) {
      blocks.push({
        type: "heading",
        attrs: { level: 3 },
        content: parseInline(h3[1]),
      });
      i++;
      continue;
    }

    const h2 = /^## (.+)/.exec(line);
    if (h2) {
      blocks.push({
        type: "heading",
        attrs: { level: 2 },
        content: parseInline(h2[1]),
      });
      i++;
      continue;
    }

    const h1 = /^# (.+)/.exec(line);
    if (h1) {
      blocks.push({
        type: "heading",
        attrs: { level: 1 },
        content: parseInline(h1[1]),
      });
      i++;
      continue;
    }

    const ul = /^- (.+)/.exec(line);
    if (ul) {
      const items: ListItemNode[] = [];
      while (i < lines.length) {
        const match = /^- (.+)/.exec(lines[i]);
        if (!match) break;
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(match[1]) }],
        });
        i++;
      }
      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    const ol = /^\d+\. (.+)/.exec(line);
    if (ol) {
      const items: ListItemNode[] = [];
      while (i < lines.length) {
        const match = /^\d+\. (.+)/.exec(lines[i]);
        if (!match) break;
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(match[1]) }],
        });
        i++;
      }
      blocks.push({ type: "orderedList", content: items });
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: quoteLines.map((l) => ({
          type: "paragraph" as const,
          content: parseInline(l),
        })),
      });
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: "codeBlock",
        content: codeLines.map((l) => ({ type: "text", text: l })),
      });
      continue;
    }

    blocks.push({
      type: "paragraph",
      content: parseInline(line),
    });
    i++;
  }

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph" });
  }

  return { type: "doc", content: blocks };
}

function serializeInline(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      const marks = node.marks ?? [];
      let text = node.text;
      for (const mark of marks) {
        switch (mark.type) {
          case "bold":
            text = `**${text}**`;
            break;
          case "italic":
            text = `*${text}*`;
            break;
          case "strike":
            text = `~~${text}~~`;
            break;
          case "code":
            text = `\`${text}\``;
            break;
          case "link":
            text = `[${text}](${mark.attrs.href})`;
            break;
        }
      }
      return text;
    })
    .join("");
}

export function docToMarkdown(doc: DocNode): string {
  const lines: string[] = [];

  for (const block of doc.content) {
    switch (block.type) {
      case "paragraph": {
        const content = block.content ?? [];
        lines.push(serializeInline(content));
        break;
      }
      case "heading": {
        const prefix = "#".repeat(block.attrs.level);
        const content = block.content ?? [];
        lines.push(`${prefix} ${serializeInline(content)}`);
        break;
      }
      case "bulletList": {
        for (const item of block.content ?? []) {
          const inner = item.content
            .map((n) => {
              if (n.type === "hardBreak") return "";
              if (n.type === "text") return n.text;
              if ("content" in n && Array.isArray(n.content)) {
                return serializeInline(n.content as InlineNode[]);
              }
              return "";
            })
            .join("");
          lines.push(`- ${inner}`);
        }
        break;
      }
      case "orderedList": {
        let idx = 1;
        for (const item of block.content ?? []) {
          const inner = item.content
            .map((n) => {
              if (n.type === "hardBreak") return "";
              if (n.type === "text") return n.text;
              if ("content" in n && Array.isArray(n.content)) {
                return serializeInline(n.content as InlineNode[]);
              }
              return "";
            })
            .join("");
          lines.push(`${idx}. ${inner}`);
          idx++;
        }
        break;
      }
      case "blockquote": {
        for (const child of block.content ?? []) {
          if (child.type === "paragraph") {
            const content = child.content ?? [];
            lines.push(`> ${serializeInline(content)}`);
          }
        }
        break;
      }
      case "codeBlock": {
        lines.push("```");
        for (const textNode of block.content ?? []) {
          lines.push(textNode.text);
        }
        lines.push("```");
        break;
      }
    }
  }

  return lines.join("\n");
}
