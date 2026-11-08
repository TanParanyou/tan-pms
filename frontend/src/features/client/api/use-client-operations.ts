"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  WorkOrderItemDto,
  WorkOrderListResponse,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
} from "@/features/work-orders/types";
import type { ParcelListResponse } from "@/features/parcels/types";
import type { NotificationListResponse } from "@/generated/api";
import { invalidateClientCaches } from "./invalidate-client";

export function useClientWorkOrders(status?: string) {
  return useQuery<WorkOrderListResponse>({
    queryKey: queryKeys.clientPortal.workOrders(status),
    queryFn: () => apiClient.getClientWorkOrders({ status }),
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

export function useClientParcels(status?: string) {
  return useQuery<ParcelListResponse>({
    queryKey: queryKeys.clientPortal.parcels(status),
    queryFn: () => apiClient.getClientParcels({ status }),
  });
}

export function useClientNotifications() {
  return useQuery<NotificationListResponse>({
    queryKey: queryKeys.clientPortal.notifications(),
    queryFn: () => apiClient.getClientNotifications(),
  });
}
