import type { AiSchemaIndexSnapshot } from "@ai-native/core";

function componentsSummary(index: AiSchemaIndexSnapshot): string {
  const lines: string[] = [];
  for (const [, entry] of Object.entries(index.components)) {
    const ai = entry.ai;
    const keywords = ai?.keywords?.join(", ") ?? "";
    const usage = ai?.usage?.join(", ") ?? "";
    const anti = ai?.antiPatterns?.join(", ") ?? "";

    let line = `- ${entry.type} (${entry.name}): ${entry.description}`;
    if (keywords) line += `. Keywords: ${keywords}.`;
    if (usage) line += ` Best for: ${usage}.`;
    if (anti) line += ` Avoid for: ${anti}.`;
    lines.push(line);
  }
  return lines.join("\n");
}

export function enrichCreateDashboardDescription(
  baseDescription: string,
  index: AiSchemaIndexSnapshot,
): string {
  const summary = componentsSummary(index);
  return `${baseDescription}\n\nAvailable widget types:\n${summary}`;
}
