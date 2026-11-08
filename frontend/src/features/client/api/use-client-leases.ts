"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { LeaseItemDto, LeaseListResponse } from "@/features/leases/types";
import type {
  LeaseIntentDto,
  LeaseIntentListResponse,
  CreateLeaseIntentRequest,
  UpdateLeaseIntentRequest,
} from "../types";
import { invalidateClientCaches } from "./invalidate-client";

export function useClientLeases() {
  return useQuery<LeaseListResponse>({
    queryKey: queryKeys.clientPortal.leases(),
    queryFn: () => apiClient.getClientLeases(),
  });
}

export function useClientLease(leaseId: string) {
  return useQuery<LeaseItemDto>({
    queryKey: queryKeys.clientPortal.lease(leaseId),
    queryFn: () => apiClient.getClientLease(leaseId),
  });
}

export function useClientLeaseIntents() {
  return useQuery<LeaseIntentListResponse>({
    queryKey: queryKeys.clientPortal.leaseIntents(),
    queryFn: () => apiClient.getClientLeaseIntents(),
  });
}

export function useCreateLeaseIntentMutation() {
  const qc = useQueryClient();
  return useMutation<LeaseIntentDto, Error, { leaseId: string; req: CreateLeaseIntentRequest }>({
    mutationFn: ({ leaseId, req }) => apiClient.createClientLeaseIntent(leaseId, req),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useUpdateLeaseIntentMutation() {
  const qc = useQueryClient();
  return useMutation<LeaseIntentDto, Error, { intentId: string; req: UpdateLeaseIntentRequest }>({
    mutationFn: ({ intentId, req }) => apiClient.updateClientLeaseIntent(intentId, req),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useWithdrawLeaseIntentMutation() {
  const qc = useQueryClient();
  return useMutation<LeaseIntentDto, Error, string>({
    mutationFn: (intentId) => apiClient.withdrawClientLeaseIntent(intentId),
    onSuccess: () => invalidateClientCaches(qc),
  });
}
