"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { AdminPaymentSlipDto, PaymentSlipQueueResponse } from "../types";

export function useAdminPaymentSlips(propertyId: string, status?: string) {
  return useQuery<PaymentSlipQueueResponse>({
    queryKey: queryKeys.payments.slips(propertyId, status),
    queryFn: () => apiClient.getAdminPaymentSlips(propertyId, { status }),
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
