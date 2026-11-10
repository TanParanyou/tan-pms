"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { AdminPaymentSlipDto, PaymentSlipQueueResponse } from "../types";

export function useAdminPaymentSlips(propertyId: string, status?: string, paging: PagingParams = {}) {
  return useQuery<PaymentSlipQueueResponse>({
    queryKey: [...queryKeys.payments.slips(propertyId, status), paging],
    queryFn: () => apiClient.getAdminPaymentSlips(propertyId, { status, ...paging }),
    placeholderData: keepPreviousData,
  });
}

export function useApproveSlipMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slipId: string) => apiClient.approveAdminPaymentSlip(propertyId, slipId),
    onSuccess: () => invalidateOperationalCaches(queryClient),
  });
}

export function useRejectSlipMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slipId, reason }: { slipId: string; reason: string }) =>
      apiClient.rejectAdminPaymentSlip(propertyId, slipId, { reason }),
    onSuccess: () => invalidateOperationalCaches(queryClient),
  });
}

export function useAdminPaymentSlip(propertyId: string, slipId: string | null) {
  return useQuery<AdminPaymentSlipDto>({
    queryKey: queryKeys.payments.slip(propertyId, slipId ?? ""),
    queryFn: () => apiClient.getAdminPaymentSlip(propertyId, slipId ?? ""),
    enabled: slipId !== null,
  });
}
