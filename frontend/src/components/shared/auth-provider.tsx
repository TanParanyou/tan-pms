"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { buildLoginUrl, scopeFromPath } from "@/lib/auth/return-to";
import {
  clearSession,
  getAccessToken,
  getAccessTokenExpiresAt,
  getAuthState,
  getRefreshToken,
  initAuthChannel,
  isAccessTokenExpiring,
  onForcedLogout,
} from "@/lib/auth/session-store";
import { useAuthState } from "@/lib/auth/use-auth-state";

/** Refresh this long before the access token expires. */
export const REFRESH_LEAD_MS = 60_000;

const currentPath = () => `${window.location.pathname}${window.location.search}`;

/**
 * Session lifecycle: restore from the refresh token on start, proactive refresh before expiry, refresh on tab
 * focus, redirect to login when the session cannot be renewed, and logout propagation from other tabs.
 *
 * Multi-tab limitation: refresh tokens rotate and sessionStorage is per tab, so each tab owns its own token
 * family. Duplicated tabs (which copy sessionStorage) can race on refresh; the backend then revokes the family
 * and the tab that loses is sent to login. Within one tab refreshes are single-flight (see ApiClient).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, profile } = useAuthState();
  const ending = useRef(false);

  // Session ended (refresh failed or another tab signed out): clear everything and go to the matching login.
  useEffect(() => {
    const end = (scopeOverride?: "admin" | "client") => {
      if (ending.current) return;
      ending.current = true;
      const scope = scopeOverride ?? getAuthState().profile?.scope ?? scopeFromPath(window.location.pathname);
      const returnTo = currentPath();
      clearSession({ broadcast: false });
      queryClient.clear();
      router.replace(buildLoginUrl(scope, returnTo));
      window.setTimeout(() => {
        ending.current = false;
      }, 0);
    };
    apiClient.setAuthFailureHandler(() => end());
    const offForced = onForcedLogout(() => end());
    initAuthChannel();
    return () => {
      apiClient.setAuthFailureHandler(null);
      offForced();
    };
  }, [queryClient, router]);

  // Restore after a reload: the access token is memory-only, so renew it from the refresh token.
  useEffect(() => {
    if (getAuthState().status !== "restoring") return;
    if (getAccessToken()) return;
    if (!getRefreshToken()) {
      clearSession({ broadcast: false });
      return;
    }
    void apiClient.refreshSession().then((ok) => {
      if (!ok) clearSession({ broadcast: false });
    });
  }, []);

  // Proactive refresh shortly before expiry.
  useEffect(() => {
    if (status !== "authenticated") return;
    const expiresAt = getAccessTokenExpiresAt();
    if (expiresAt === null) return;
    const delay = Math.max(0, expiresAt - Date.now() - REFRESH_LEAD_MS);
    const timer = window.setTimeout(() => void apiClient.refreshSession(), delay);
    return () => window.clearTimeout(timer);
  }, [status, profile]);

  // Tab regains focus after sleeping: renew when the token already expired or is about to.
  useEffect(() => {
    if (status !== "authenticated") return;
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      if (isAccessTokenExpiring(REFRESH_LEAD_MS)) void apiClient.refreshSession();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [status]);

  return <>{children}</>;
}
