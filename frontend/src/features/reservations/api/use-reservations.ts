"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { UpdateReservationRequest } from "@/features/client/types";
import type {
  ReservationListResponse,
  ReservationItemDto,
  CreateAdminReservationRequest,
  AssignReservationUnitRequest,
  CancelReservationRequest,
  AvailabilitySearchResponse,
} from "@/generated/api";

export function useAdminReservations(propertyId: string, filters: { status?: string; stayMode?: string } = {}, paging: PagingParams = {}) {
  return useQuery<ReservationListResponse>({
    queryKey: [...queryKeys.reservations.list(propertyId, filters.status, filters.stayMode), paging],
    queryFn: () => apiClient.getAdminReservations(propertyId, { ...filters, ...paging }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminReservationDetail(propertyId: string, reservationId: string) {
  return useQuery<ReservationItemDto>({
    queryKey: [...queryKeys.reservations.detail(reservationId), propertyId],
    queryFn: () => apiClient.getAdminReservation(propertyId, reservationId),
    enabled: Boolean(reservationId && reservationId !== "create"),
  });
}

export function useAdminAvailabilityQuery(
  propertyId: string,
  params: { checkIn: string; checkOut: string; stayMode: string } | null
) {
  return useQuery<AvailabilitySearchResponse>({
    queryKey: queryKeys.availability.search(propertyId, params ?? {}),
    queryFn: () => apiClient.getAdminAvailability(propertyId, params as { checkIn: string; checkOut: string; stayMode: string }),
    enabled: params !== null,
  });
}

// A reservation changes quota, rack state and availability: await every operational cache plus its own lists.
function useReservationMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, TVars>({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all }),
        queryClient.invalidateQueries({ queryKey: ["admin-reservation-detail"] }),
        invalidateOperationalCaches(queryClient),
      ]);
    },
  });
}

export function useCreateAdminReservationMutation(propertyId: string) {
  const m = useReservationMutation((req: CreateAdminReservationRequest) => apiClient.createAdminReservation(propertyId, req));
  return { ...m, mutateAsync: (req: CreateAdminReservationRequest) => m.mutateAsync(req) as Promise<ReservationItemDto> };
}
export function useUpdateAdminReservationMutation(propertyId: string) {
  return useReservationMutation(({ id, req }: { id: string; req: UpdateReservationRequest }) => apiClient.updateAdminReservation(propertyId, id, req));
}
export function useAssignReservationUnitMutation(propertyId: string) {
  return useReservationMutation(({ id, req }: { id: string; req: AssignReservationUnitRequest }) => apiClient.assignAdminReservationUnit(propertyId, id, req));
}
export function useConfirmAdminReservationMutation(propertyId: string) {
  return useReservationMutation((id: string) => apiClient.confirmAdminReservation(propertyId, id));
}
export function useCancelAdminReservationMutation(propertyId: string) {
  return useReservationMutation(({ id, req }: { id: string; req: CancelReservationRequest }) => apiClient.cancelAdminReservation(propertyId, id, req));
}
export function useDeleteAdminReservationMutation(propertyId: string) {
  return useReservationMutation((id: string) => apiClient.deleteAdminReservation(propertyId, id));
}
