"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ClientDashboardResponse } from "../types";

export function useClientDashboard() {
  return useQuery<ClientDashboardResponse>({
    queryKey: queryKeys.clientDashboard.summary(),
    queryFn: () => apiClient.getClientDashboard(),
  });
}
