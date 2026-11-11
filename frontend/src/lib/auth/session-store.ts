import type { components } from "@/generated/api/tan-pms.v1";

export type AuthSessionResponse = components["schemas"]["AuthSessionResponse"];
export type SessionProfile = Omit<AuthSessionResponse, "accessToken" | "accessTokenExpiresAt" | "refreshToken" | "refreshTokenExpiresAt" | "tokenType">;

export interface AuthState {
  status: "restoring" | "authenticated" | "unauthenticated";
  profile: SessionProfile | null;
}

/**
 * The ONE place that holds authentication material.
 *
 * - access token: module memory only (never storage), lost on reload and restored from the refresh token.
 * - refresh token: sessionStorage (per tab, cleared when the tab closes). XSS trade-off: script running in
 *   the page could read it; we accept that instead of localStorage (survives tabs/restarts, wider exposure)
 *   and instead of an httpOnly cookie (backend contract returns the token in the body).
 * - profile (permissions, allowed properties, customer): memory only, refreshed on every login/refresh/me.
 * Tokens are never logged and never placed in URLs.
 */
export const REFRESH_TOKEN_STORAGE_KEY = "tan-pms.auth.refresh-token";
const CHANNEL_NAME = "tan-pms-auth";
const SKEW_MS = 5_000;

let accessToken: string | null = null;
let accessTokenExpiresAt: number | null = null;
let state: AuthState = { status: "restoring", profile: null };
const listeners = new Set<() => void>();
const forcedLogoutListeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function emit(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === "undefined") return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === "logout") {
      // Another tab signed out: end this session locally without echoing the broadcast.
      clearSession({ broadcast: false });
      forcedLogoutListeners.forEach((l) => l());
    }
  };
  return channel;
}

export function initAuthChannel(): void {
  getChannel();
}

export function getAuthState(): AuthState {
  return state;
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onForcedLogout(listener: () => void): () => void {
  forcedLogoutListeners.add(listener);
  return () => forcedLogoutListeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAccessTokenExpiresAt(): number | null {
  return accessTokenExpiresAt;
}

export function isAccessTokenExpiring(withinMs = SKEW_MS, now = Date.now()): boolean {
  return accessToken === null || (accessTokenExpiresAt !== null && accessTokenExpiresAt - now <= withinMs);
}

export function getRefreshToken(): string | null {
  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSession(response: AuthSessionResponse): void {
  const { accessToken: token, accessTokenExpiresAt: expires, refreshToken, ...rest } = response;
  accessToken = token;
  accessTokenExpiresAt = expires ? new Date(expires).getTime() : null;
  if (refreshToken) {
    try {
      window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    } catch {
      // Without storage the session simply cannot survive a reload.
    }
  }
  const profile: SessionProfile = {
    userId: rest.userId,
    scope: rest.scope,
    displayName: rest.displayName,
    roleCode: rest.roleCode,
    roleName: rest.roleName,
    allowedProperties: rest.allowedProperties,
    permissions: rest.permissions,
    customer: rest.customer,
  };
  getChannel();
  emit({ status: "authenticated", profile });
}

export function clearSession(options: { broadcast?: boolean } = {}): void {
  accessToken = null;
  accessTokenExpiresAt = null;
  try {
    window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (options.broadcast ?? true) getChannel()?.postMessage({ type: "logout" });
  emit({ status: "unauthenticated", profile: null });
}

export function markRestoring(): void {
  emit({ status: "restoring", profile: state.profile });
}

/** Test helper: back to the pristine boot state without broadcasting. */
export function resetSessionForTests(): void {
  accessToken = null;
  accessTokenExpiresAt = null;
  try {
    window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
  state = { status: "restoring", profile: null };
}
