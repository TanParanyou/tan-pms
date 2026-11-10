"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";

const APP_STORAGE_PREFIX = "tan-pms";

function clearBrowserSession() {
  try {
    window.sessionStorage.clear();
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(APP_STORAGE_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode); nothing else to clear.
  }
}

/** Central sign-out: tell the backend, drop browser session data and every cached query, then go to /login. */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await apiClient.logout();
    } catch {
      // A failed or 401 logout still ends the local session: the token is discarded client-side.
    } finally {
      clearBrowserSession();
      queryClient.clear();
      router.push("/login");
      setIsSigningOut(false);
    }
  }, [isSigningOut, queryClient, router]);

  return { signOut, isSigningOut };
}
