"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type {
  HousekeepingTaskListResponse,
  CreateHousekeepingTaskRequest,
  CompleteHousekeepingTaskRequest,
  AssignHousekeepingTaskRequest,
  UpdateHousekeepingTaskRequest,
} from "../types";

export function useAdminHousekeepingTasks(propertyId: string, status?: string, buildingId?: string, paging: PagingParams = {}) {
  return useQuery<HousekeepingTaskListResponse>({
    queryKey: [...queryKeys.housekeeping.list(propertyId, status, buildingId), paging],
    queryFn: () => apiClient.getAdminHousekeepingTasks(propertyId, { status, buildingId, ...paging }),
    placeholderData: keepPreviousData,
  });
}

// Task transitions change the unit condition (rack, availability): refresh every operational cache.
function useHousekeepingMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateOperationalCaches(queryClient) });
}

export function useCreateHousekeepingTaskMutation(propertyId: string) {
  return useHousekeepingMutation((req: CreateHousekeepingTaskRequest) =>
    apiClient.createAdminHousekeepingTask(propertyId, req)
  );
}

export function useStartHousekeepingTaskMutation(propertyId: string) {
  return useHousekeepingMutation((taskId: string) => apiClient.startAdminHousekeepingTask(propertyId, taskId));
}

export function useCompleteHousekeepingTaskMutation(propertyId: string) {
  return useHousekeepingMutation(({ taskId, req }: { taskId: string; req: CompleteHousekeepingTaskRequest }) =>
    apiClient.completeAdminHousekeepingTask(propertyId, taskId, req)
  );
}

export function useAssignHousekeepingTaskMutation(propertyId: string) {
  return useHousekeepingMutation(({ taskId, req }: { taskId: string; req: AssignHousekeepingTaskRequest }) =>
    apiClient.assignAdminHousekeepingTask(propertyId, taskId, req)
  );
}

export function useUpdateHousekeepingTaskMutation(propertyId: string) {
  return useHousekeepingMutation(({ taskId, req }: { taskId: string; req: UpdateHousekeepingTaskRequest }) =>
    apiClient.updateAdminHousekeepingTask(propertyId, taskId, req)
  );
}

export function useDeleteHousekeepingTaskMutation(propertyId: string) {
  return useHousekeepingMutation((taskId: string) => apiClient.deleteAdminHousekeepingTask(propertyId, taskId));
}
