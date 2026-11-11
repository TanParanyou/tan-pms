import { apiClient } from "@/lib/api/api-client";
import type { LoginRequest } from "@/generated/api";
import { setSession, type AuthSessionResponse } from "./session-store";

/** Signs in; the response (tokens + profile) goes straight into the session store and is never returned to UI state. */
export async function loginWithCredentials(req: LoginRequest): Promise<AuthSessionResponse["scope"]> {
  const response = await apiClient.login(req);
  setSession(response);
  return response.scope;
}
