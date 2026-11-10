"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  WorkOrderItemDto,
  WorkOrderListResponse,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
} from "@/features/work-orders/types";
import type { ParcelItemDto, ParcelListResponse } from "@/features/parcels/types";
import type { NotificationListResponse } from "@/generated/api";
import { invalidateClientCaches } from "./invalidate-client";

export function useClientWorkOrders(status?: string, paging: PagingParams = {}) {
  return useQuery<WorkOrderListResponse>({
    queryKey: [...queryKeys.clientPortal.workOrders(status), paging],
    queryFn: () => apiClient.getClientWorkOrders({ status, ...paging }),
    placeholderData: keepPreviousData,
  });
}

export function useClientWorkOrder(id: string, enabled = true) {
  return useQuery<WorkOrderItemDto>({
    queryKey: queryKeys.clientPortal.workOrder(id),
    queryFn: () => apiClient.getClientWorkOrder(id),
    enabled,
  });
}

export function useCreateClientWorkOrderMutation() {
  const qc = useQueryClient();
  return useMutation<WorkOrderItemDto, Error, CreateWorkOrderRequest>({
    mutationFn: (req) => apiClient.createClientWorkOrder(req),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useUpdateClientWorkOrderMutation() {
  const qc = useQueryClient();
  return useMutation<WorkOrderItemDto, Error, { id: string; req: UpdateWorkOrderRequest }>({
    mutationFn: ({ id, req }) => apiClient.updateClientWorkOrder(id, req),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useCancelClientWorkOrderMutation() {
  const qc = useQueryClient();
  return useMutation<WorkOrderItemDto, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => apiClient.cancelClientWorkOrder(id, reason),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useClientParcels(status?: string, paging: PagingParams = {}) {
  return useQuery<ParcelListResponse>({
    queryKey: [...queryKeys.clientPortal.parcels(status), paging],
    queryFn: () => apiClient.getClientParcels({ status, ...paging }),
    placeholderData: keepPreviousData,
  });
}

export function useClientNotifications(paging: PagingParams = {}) {
  return useQuery<NotificationListResponse>({
    queryKey: [...queryKeys.clientPortal.notifications(), paging],
    queryFn: () => apiClient.getClientNotifications(paging),
    placeholderData: keepPreviousData,
  });
}

export function useClientParcel(id: string) {
  return useQuery<ParcelItemDto>({
    queryKey: queryKeys.clientPortal.parcel(id),
    queryFn: () => apiClient.getClientParcel(id),
  });
}
