const ROUTE_REGEX = /^\//;
const TRAILING_SLASH_REGEX = /\/+$/;

export function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) return "";
  let normalized = trimmed.toLowerCase();
  if (!ROUTE_REGEX.test(normalized)) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(TRAILING_SLASH_REGEX, "");
  if (!normalized) return "";
  return normalized;
}
