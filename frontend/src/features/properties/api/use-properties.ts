"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { PropertyHierarchyResponse, UnitMasterItemDto, UpsertUnitMasterRequest } from "@/generated/api";
import type { UpsertBuildingRequest, UpsertFloorRequest, UpsertUnitTypeRequest } from "@/features/client/types";

export function usePropertyHierarchy(propertyId: string) {
  return useQuery<PropertyHierarchyResponse>({
    queryKey: queryKeys.properties.hierarchy(propertyId),
    queryFn: () => apiClient.getAdminPropertyHierarchy(propertyId),
  });
}

export function useUnitMasterDetail(propertyId: string, unitId: string) {
  return useQuery<UnitMasterItemDto>({
    queryKey: [...queryKeys.properties.unitDetail(unitId), propertyId],
    queryFn: () => apiClient.getAdminUnit(propertyId, unitId),
    enabled: Boolean(unitId && unitId !== "create"),
  });
}

// Master data feeds rack, availability, rates and reservations: await every dependent cache.
function useMasterMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.properties.all }),
        queryClient.invalidateQueries({ queryKey: ["admin-unit-detail"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.rates.all }),
        invalidateOperationalCaches(queryClient),
      ]);
    },
  });
}

export function useUpsertUnitMasterMutation(propertyId: string) {
  return useMasterMutation((req: UpsertUnitMasterRequest) => apiClient.upsertAdminUnitMaster(propertyId, req));
}
export function useDeleteUnitMutation(propertyId: string) {
  return useMasterMutation((id: string) => apiClient.deleteAdminUnit(propertyId, id));
}
export function useUpsertBuildingMutation(propertyId: string) {
  return useMasterMutation((req: UpsertBuildingRequest) => apiClient.upsertAdminBuilding(propertyId, req));
}
export function useDeleteBuildingMutation(propertyId: string) {
  return useMasterMutation((id: string) => apiClient.deleteAdminBuilding(propertyId, id));
}
export function useUpsertFloorMutation(propertyId: string) {
  return useMasterMutation((req: UpsertFloorRequest) => apiClient.upsertAdminFloor(propertyId, req));
}
export function useDeleteFloorMutation(propertyId: string) {
  return useMasterMutation((id: string) => apiClient.deleteAdminFloor(propertyId, id));
}
export function useUpsertUnitTypeMutation(propertyId: string) {
  return useMasterMutation((req: UpsertUnitTypeRequest) => apiClient.upsertAdminUnitType(propertyId, req));
}
export function useDeleteUnitTypeMutation(propertyId: string) {
  return useMasterMutation((id: string) => apiClient.deleteAdminUnitType(propertyId, id));
}
