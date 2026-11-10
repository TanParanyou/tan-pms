"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AvailabilitySearchResponse,
  CreateClientHoldReservationRequest,
  ReservationItemDto,
  ReservationListResponse,
} from "@/generated/api";
import { invalidateClientCaches } from "./invalidate-client";

export interface ClientAvailabilityParams {
  propertyId: string;
  stayMode: string;
  slotStartAt: string;
  slotEndAt: string;
}

export function useClientAvailability(params: ClientAvailabilityParams | null) {
  return useQuery<AvailabilitySearchResponse>({
    queryKey: queryKeys.clientPortal.availability(params ?? {}),
    queryFn: () => apiClient.getClientAvailability(params as ClientAvailabilityParams),
    enabled: params !== null,
  });
}

export function useClientReservations(paging: PagingParams = {}) {
  return useQuery<ReservationListResponse>({
    queryKey: [...queryKeys.clientPortal.reservations(), paging],
    queryFn: () => apiClient.getClientReservations(paging),
    placeholderData: keepPreviousData,
  });
}

export function useClientReservation(id: string) {
  return useQuery<ReservationItemDto>({
    queryKey: queryKeys.clientPortal.reservation(id),
    queryFn: () => apiClient.getClientReservation(id),
  });
}

export function useCreateClientHoldMutation() {
  const qc = useQueryClient();
  return useMutation<ReservationItemDto, Error, CreateClientHoldReservationRequest>({
    mutationFn: (req) => apiClient.createClientHoldReservation(req),
    onSuccess: async () => {
      await invalidateClientCaches(qc);
      await qc.invalidateQueries({ queryKey: queryKeys.availability.all });
    },
  });
}

export function useSubmitReservationSlipMutation() {
  const qc = useQueryClient();
  return useMutation<ReservationItemDto, Error, { id: string; paymentSlipFileKey: string }>({
    mutationFn: ({ id, paymentSlipFileKey }) => apiClient.submitClientReservationSlip(id, { paymentSlipFileKey }),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useCancelClientReservationMutation() {
  const qc = useQueryClient();
  return useMutation<ReservationItemDto, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => apiClient.cancelClientReservation(id, reason),
    onSuccess: async () => {
      await invalidateClientCaches(qc);
      await qc.invalidateQueries({ queryKey: queryKeys.availability.all });
    },
  });
}
