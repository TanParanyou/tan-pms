"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { INITIAL_ADMIN_USERS, INITIAL_ROLE_CATALOG } from "../constants";
import type {
  AdminUserListResponse,
  AdminUserDto,
  RoleCatalogResponse,
  UpsertAdminUserRequest,
  DispatchNotificationRequest,
} from "@/generated/api";

export function useAdminUsers() {
  return useQuery<AdminUserListResponse>({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      try {
        return await apiClient.getAdminUsers();
      } catch {
        return {
          items: INITIAL_ADMIN_USERS,
        };
      }
    },
    placeholderData: {
      items: INITIAL_ADMIN_USERS,
    },
  });
}

export function useAdminRoles() {
  return useQuery<RoleCatalogResponse>({
    queryKey: queryKeys.roles.list(),
    queryFn: async () => {
      try {
        return await apiClient.getAdminRoles();
      } catch {
        return {
          roles: INITIAL_ROLE_CATALOG,
          permissions: [],
        };
      }
    },
    placeholderData: {
      roles: INITIAL_ROLE_CATALOG,
      permissions: [],
    },
  });
}

export function useAdminUserDetail(userId: string) {
  return useQuery<AdminUserDto | null>({
    queryKey: queryKeys.users.detail(userId),
    queryFn: async () => {
      try {
        const res = await apiClient.getAdminUsers();
        return res.items.find((u) => u.id === userId || u.username === userId) ?? null;
      } catch {
        const fallback = INITIAL_ADMIN_USERS.find((u) => u.id === userId || u.username === userId);
        return fallback ?? INITIAL_ADMIN_USERS[0] ?? null;
      }
    },
    enabled: Boolean(userId && userId !== "create"),
  });
}

export function useUpsertAdminUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: UpsertAdminUserRequest) => {
      return await apiClient.upsertAdminUser(req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useDispatchNotificationMutation() {
  return useMutation({
    mutationFn: async (req: DispatchNotificationRequest) => {
      return await apiClient.dispatchAdminNotification(req);
    },
  });
}
