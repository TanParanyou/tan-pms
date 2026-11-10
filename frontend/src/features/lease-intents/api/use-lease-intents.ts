"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { LeaseIntentDto, LeaseIntentListResponse } from "@/features/client/types";

export function useAdminLeaseIntents(propertyId: string, status?: string, enabled = true, paging: PagingParams = {}) {
  return useQuery<LeaseIntentListResponse>({
    queryKey: [...queryKeys.leaseIntents.list(propertyId, status), paging],
    queryFn: () => apiClient.getAdminLeaseIntents(propertyId, { status, ...paging }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

// Approving applies a renewal / move-out notice to the lease, so refresh every operational cache plus the intent queue.
async function refreshAfterReview(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.leaseIntents.all }),
    invalidateOperationalCaches(queryClient),
  ]);
}

export function useApproveLeaseIntentMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation<LeaseIntentDto, Error, string>({
    mutationFn: (intentId) => apiClient.approveAdminLeaseIntent(propertyId, intentId),
    onSuccess: () => refreshAfterReview(queryClient),
  });
}

export function useRejectLeaseIntentMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation<LeaseIntentDto, Error, { intentId: string; reason: string }>({
    mutationFn: ({ intentId, reason }) => apiClient.rejectAdminLeaseIntent(propertyId, intentId, reason),
    onSuccess: () => refreshAfterReview(queryClient),
  });
}
