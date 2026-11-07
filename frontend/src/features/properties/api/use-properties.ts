"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  INITIAL_UNIT_MASTER_ITEMS,
} from "../constants";
import type {
  PropertyHierarchyResponse,
  UnitMasterItemDto,
  UpsertUnitMasterRequest,
} from "@/generated/api";

export function usePropertyHierarchy(propertyId: string) {
  return useQuery<PropertyHierarchyResponse>({
    queryKey: queryKeys.properties.hierarchy(propertyId),
    queryFn: () => apiClient.getAdminPropertyHierarchy(propertyId),
  });
}

export function useUnitMasterDetail(propertyId: string, unitId: string) {
  return useQuery<UnitMasterItemDto | null>({
    queryKey: queryKeys.properties.unitDetail(unitId),
    queryFn: async () => {
      try {
        const hierarchy = await apiClient.getAdminPropertyHierarchy(propertyId);
        return hierarchy.units.find((u) => u.id === unitId) ?? null;
      } catch {
        const fallback = INITIAL_UNIT_MASTER_ITEMS.find((u) => u.id === unitId);
        return fallback ?? INITIAL_UNIT_MASTER_ITEMS[0] ?? null;
      }
    },
    enabled: Boolean(unitId && unitId !== "create"),
  });
}

export function useUpsertUnitMasterMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: UpsertUnitMasterRequest) => {
      return await apiClient.upsertAdminUnitMaster(propertyId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
    },
  });
}
