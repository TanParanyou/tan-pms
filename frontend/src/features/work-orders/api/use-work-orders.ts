"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type {
  WorkOrderItemDto,
  WorkOrderListResponse,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
  AssignWorkOrderRequest,
  ResolveWorkOrderRequest,
} from "../types";

export function useAdminWorkOrders(propertyId: string, status?: string) {
  return useQuery<WorkOrderListResponse>({
    queryKey: queryKeys.workOrders.list(propertyId, status),
    queryFn: () => apiClient.getAdminWorkOrders(propertyId, { status }),
  });
}

export function useAdminWorkOrder(propertyId: string, workOrderId: string) {
  return useQuery<WorkOrderItemDto>({
    queryKey: queryKeys.workOrders.detail(propertyId, workOrderId),
    queryFn: () => apiClient.getAdminWorkOrder(propertyId, workOrderId),
  });
}

// Resolving can post a tenant charge (folio/invoice): refresh every operational cache.
function useWorkOrderMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateOperationalCaches(queryClient) });
}

export function useCreateWorkOrderMutation(propertyId: string) {
  return useWorkOrderMutation((req: CreateWorkOrderRequest) => apiClient.createAdminWorkOrder(propertyId, req));
}

export function useUpdateWorkOrderMutation(propertyId: string) {
  return useWorkOrderMutation(({ id, req }: { id: string; req: UpdateWorkOrderRequest }) =>
    apiClient.updateAdminWorkOrder(propertyId, id, req)
  );
}

export function useAssignWorkOrderMutation(propertyId: string) {
  return useWorkOrderMutation(({ id, req }: { id: string; req: AssignWorkOrderRequest }) =>
    apiClient.assignAdminWorkOrder(propertyId, id, req)
  );
}

export function useResolveWorkOrderMutation(propertyId: string) {
  return useWorkOrderMutation(({ id, req }: { id: string; req: ResolveWorkOrderRequest }) =>
    apiClient.resolveAdminWorkOrder(propertyId, id, req)
  );
}

export function useCancelWorkOrderMutation(propertyId: string) {
  return useWorkOrderMutation(({ id, reason }: { id: string; reason: string }) =>
    apiClient.cancelAdminWorkOrder(propertyId, id, reason)
  );
}
