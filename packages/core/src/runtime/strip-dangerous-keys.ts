const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function stripDangerousKeys<T extends Record<string, unknown>>(
  obj: T,
): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (!DANGEROUS_KEYS.has(key)) {
      result[key] = obj[key];
    }
  }
  return result as T;
}
