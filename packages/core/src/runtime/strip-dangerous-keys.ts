const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 20;
const MAX_KEYS = 5000;

function isNonPrimitive(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function stripDangerousKeys<T extends Record<string, unknown>>(
  obj: T,
  depth = 0,
): T {
  if (depth >= MAX_DEPTH) return obj;
  const result: Record<string, unknown> = {};
  let keyCount = 0;
  for (const key of Object.keys(obj)) {
    if (keyCount++ >= MAX_KEYS) break;
    if (DANGEROUS_KEYS.has(key)) continue;
    const val = obj[key];
    result[key] = isNonPrimitive(val)
      ? stripDangerousKeys(val, depth + 1)
      : val;
  }
  return result as T;
}
