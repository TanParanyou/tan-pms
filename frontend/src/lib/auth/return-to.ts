export type AuthScope = "admin" | "client";

export const AREA_HOME: Record<AuthScope, string> = { admin: "/admin/rack", client: "/client/dashboard" };

/**
 * Accepts only same-origin relative paths inside the matching area (/admin or /client).
 * Rejects absolute URLs, protocol-relative ("//host"), backslash tricks, control characters and other areas,
 * so a crafted `returnTo` can never redirect off-site (open redirect) or into the wrong scope.
 */
export function sanitizeReturnTo(value: string | null | undefined, scope: AuthScope): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(decoded) || decoded.includes("://")) return null;
  const area = `/${scope}`;
  if (decoded !== area && !decoded.startsWith(`${area}/`) && !decoded.startsWith(`${area}?`)) return null;
  return decoded;
}

export function buildLoginUrl(scope: AuthScope, returnTo?: string | null): string {
  const params = new URLSearchParams({ scope });
  const safe = sanitizeReturnTo(returnTo, scope);
  if (safe) params.set("returnTo", safe);
  return `/login?${params.toString()}`;
}

/** Which login scope a path belongs to (for unauthenticated redirects). */
export function scopeFromPath(pathname: string): AuthScope {
  return pathname.startsWith("/client") ? "client" : "admin";
}
