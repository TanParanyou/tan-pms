"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { buildLoginUrl } from "@/lib/auth/return-to";
import { clearSession, getAuthState, getRefreshToken } from "@/lib/auth/session-store";

/**
 * Central sign-out: revoke the refresh token on the backend, then drop the session (memory + sessionStorage),
 * every cached query and other tabs' sessions (broadcast), and go to the matching login. A failed API call
 * (offline, already expired) never blocks ending the local session.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const scope = getAuthState().profile?.scope ?? "admin";
    const refreshToken = getRefreshToken();
    try {
      await apiClient.logout(refreshToken);
    } catch {
      // The token is discarded client-side regardless; the server-side revoke is best effort.
    } finally {
      clearSession();
      queryClient.clear();
      router.push(buildLoginUrl(scope));
      setIsSigningOut(false);
    }
  }, [isSigningOut, queryClient, router]);

  return { signOut, isSigningOut };
}
