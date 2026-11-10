"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { DepositLedgerItemDto, DepositLedgerListResponse } from "../types";

export function useAdminDepositLedgers(propertyId: string, type?: string, paging: PagingParams = {}) {
  return useQuery<DepositLedgerListResponse>({
    queryKey: [...queryKeys.depositLedgers.list(propertyId, type), paging],
    queryFn: () => apiClient.getAdminDepositLedgers(propertyId, { type, ...paging }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminDepositLedger(propertyId: string, ledgerId: string | null) {
  return useQuery<DepositLedgerItemDto>({
    queryKey: queryKeys.depositLedgers.detail(propertyId, ledgerId ?? ""),
    queryFn: () => apiClient.getAdminDepositLedger(propertyId, ledgerId ?? ""),
    enabled: ledgerId !== null,
  });
}
