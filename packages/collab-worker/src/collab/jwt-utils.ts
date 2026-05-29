/**
 * Shared JWT verification and base64url decoding utilities
 * for Cloudflare Durable Object workers.
 */

export function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (base64.length % 4);
  const padded = base64 + (padding === 4 ? "" : "=".repeat(padding));
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<boolean> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64UrlDecode(sigB64);
    return crypto.subtle.verify("HMAC", key, sig, data);
  } catch {
    return false;
  }
}
