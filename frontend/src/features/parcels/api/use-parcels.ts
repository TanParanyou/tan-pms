"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { ParcelItemDto, ParcelListResponse, ReceiveParcelRequest, PickUpParcelRequest } from "../types";

export function useAdminParcels(propertyId: string, status?: string) {
  return useQuery<ParcelListResponse>({
    queryKey: queryKeys.parcels.list(propertyId, status),
    queryFn: () => apiClient.getAdminParcels(propertyId, { status }),
  });
}

export function useAdminParcel(propertyId: string, parcelId: string) {
  return useQuery<ParcelItemDto>({
    queryKey: queryKeys.parcels.detail(propertyId, parcelId),
    queryFn: () => apiClient.getAdminParcel(propertyId, parcelId),
  });
}

function useParcelMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateOperationalCaches(queryClient) });
}

export function useReceiveParcelMutation(propertyId: string) {
  return useParcelMutation((req: ReceiveParcelRequest) => apiClient.receiveAdminParcel(propertyId, req));
}

export function useUpdateParcelMutation(propertyId: string) {
  return useParcelMutation(({ id, req }: { id: string; req: ReceiveParcelRequest }) =>
    apiClient.updateAdminParcel(propertyId, id, req)
  );
}

export function usePickUpParcelMutation(propertyId: string) {
  return useParcelMutation(({ id, req }: { id: string; req: PickUpParcelRequest }) =>
    apiClient.pickUpAdminParcel(propertyId, id, req)
  );
}

export function useVoidParcelMutation(propertyId: string) {
  return useParcelMutation(({ id, reason }: { id: string; reason: string }) =>
    apiClient.voidAdminParcel(propertyId, id, reason)
  );
}
