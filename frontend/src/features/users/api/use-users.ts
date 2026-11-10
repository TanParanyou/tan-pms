"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AdminUserListResponse,
  AdminUserDto,
  RoleCatalogResponse,
  UpsertAdminUserRequest,
  DispatchNotificationRequest,
} from "@/generated/api";

export function useAdminUsers(paging: PagingParams = {}) {
  return useQuery<AdminUserListResponse>({
    queryKey: [...queryKeys.users.list(), paging],
    queryFn: () => apiClient.getAdminUsers(paging),
    placeholderData: keepPreviousData,
  });
}

export function useAdminRoles() {
  return useQuery<RoleCatalogResponse>({
    queryKey: queryKeys.roles.list(),
    queryFn: () => apiClient.getAdminRoles(),
  });
}

export function useAdminUserDetail(userId: string) {
  return useQuery<AdminUserDto>({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => apiClient.getAdminUser(userId),
    enabled: Boolean(userId && userId !== "create"),
  });
}

function useUserMutation<TVars>(mutationFn: (vars: TVars) => Promise<AdminUserDto>) {
  const queryClient = useQueryClient();
  return useMutation<AdminUserDto, Error, TVars>({
    mutationFn,
    // Role / scope / active state changes affect assignee pickers too: await every user cache.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useUpsertAdminUserMutation() {
  return useUserMutation((req: UpsertAdminUserRequest) => apiClient.upsertAdminUser(req));
}

export function useDeactivateAdminUserMutation() {
  return useUserMutation(({ id, reason }: { id: string; reason: string }) => apiClient.deactivateAdminUser(id, reason));
}

export function useReactivateAdminUserMutation() {
  return useUserMutation((id: string) => apiClient.reactivateAdminUser(id));
}

export function useDispatchNotificationMutation() {
  return useMutation({
    mutationFn: async (req: DispatchNotificationRequest) => {
      return await apiClient.dispatchAdminNotification(req);
    },
  });
}
