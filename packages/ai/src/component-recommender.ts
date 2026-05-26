import type { AiSchemaIndexSnapshot } from "@ai-native/core";

export interface Recommendation {
  componentType: string;
  name: string;
  description: string;
  score: number;
  reasons: string[];
}

export function recommendComponents(
  prompt: string,
  index: AiSchemaIndexSnapshot,
  limit = 5,
): Recommendation[] {
  const lower = prompt.toLowerCase();
  const scores: Recommendation[] = [];

  for (const [type, entry] of Object.entries(index.components)) {
    const reasons: string[] = [];
    let score = 0;

    const ai = entry.ai;
    if (ai) {
      for (const kw of ai.keywords ?? []) {
        if (lower.includes(kw.toLowerCase())) {
          score += 3;
          reasons.push(`keyword match: ${kw}`);
        }
      }
      for (const usage of ai.usage ?? []) {
        if (lower.includes(usage.toLowerCase())) {
          score += 2;
          reasons.push(`usage match: ${usage}`);
        }
      }
      for (const anti of ai.antiPatterns ?? []) {
        if (lower.includes(anti.toLowerCase())) {
          score -= 5;
          reasons.push(`anti-pattern avoided: ${anti}`);
        }
      }
      for (const rel of ai.relatedComponents ?? []) {
        if (lower.includes(rel.toLowerCase())) {
          score += 1;
          reasons.push(`related match: ${rel}`);
        }
      }
    }

    if (lower.includes(entry.name.toLowerCase())) {
      score += 4;
      reasons.push(`name match: ${entry.name}`);
    }

    const category = entry.category;
    if (category && lower.includes(category.toLowerCase())) {
      score += 1;
      reasons.push(`category match: ${category}`);
    }

    scores.push({
      componentType: type,
      name: entry.name,
      description: entry.description,
      score,
      reasons,
    });
  }

  scores.sort((a, b) => b.score - a.score);

  return scores.filter((s) => s.score > 0).slice(0, limit);
}
