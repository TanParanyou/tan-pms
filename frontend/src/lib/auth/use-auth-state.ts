"use client";

import { useSyncExternalStore } from "react";
import { getAuthState, subscribeAuth, type AuthState } from "./session-store";

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState);
}
