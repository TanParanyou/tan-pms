"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { DepositLedgerListResponse } from "../types";

export function useAdminDepositLedgers(propertyId: string, type?: string) {
  return useQuery<DepositLedgerListResponse>({
    queryKey: queryKeys.depositLedgers.list(propertyId, type),
    queryFn: () => apiClient.getAdminDepositLedgers(propertyId, { type }),
  });
}
