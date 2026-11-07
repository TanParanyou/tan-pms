"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { INITIAL_RESERVATIONS } from "../constants";
import type {
  ReservationListResponse,
  ReservationItemDto,
  CreateAdminReservationRequest,
  AssignReservationUnitRequest,
  CancelReservationRequest,
  AvailabilitySearchResponse,
  CreateClientHoldReservationRequest,
  SubmitReservationSlipRequest,
} from "@/generated/api";

export function useAdminReservations(propertyId: string) {
  return useQuery<ReservationListResponse>({
    queryKey: queryKeys.reservations.list(propertyId),
    queryFn: async () => {
      try {
        return await apiClient.getAdminReservations(propertyId);
      } catch {
        return {
          items: INITIAL_RESERVATIONS,
        };
      }
    },
    placeholderData: {
      items: INITIAL_RESERVATIONS,
    },
  });
}

export function useAdminReservationDetail(propertyId: string, reservationId: string) {
  return useQuery<ReservationItemDto | null>({
    queryKey: queryKeys.reservations.detail(reservationId),
    queryFn: async () => {
      try {
        const res = await apiClient.getAdminReservations(propertyId);
        const item = res.items.find((r) => r.id === reservationId || r.documentNumber === reservationId);
        return item ?? null;
      } catch {
        const fallback = INITIAL_RESERVATIONS.find(
          (r) => r.id === reservationId || r.documentNumber === reservationId
        );
        return fallback ?? INITIAL_RESERVATIONS[0] ?? null;
      }
    },
    enabled: Boolean(reservationId && reservationId !== "create"),
  });
}

export function useAdminAvailabilityQuery(
  propertyId: string,
  params: { checkIn: string; checkOut: string; stayMode?: string }
) {
  return useQuery<AvailabilitySearchResponse>({
    queryKey: queryKeys.availability.search(propertyId, params),
    queryFn: async () => {
      return await apiClient.getAdminAvailability(propertyId, params);
    },
    enabled: Boolean(params.checkIn && params.checkOut),
  });
}

export function useCreateAdminReservationMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateAdminReservationRequest) => {
      return await apiClient.createAdminReservation(propertyId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all });
    },
  });
}

export function useAssignReservationUnitMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      req,
    }: {
      reservationId: string;
      req: AssignReservationUnitRequest;
    }) => {
      return await apiClient.assignAdminReservationUnit(propertyId, reservationId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all });
    },
  });
}

export function useConfirmAdminReservationMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      return await apiClient.confirmAdminReservation(propertyId, reservationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all });
    },
  });
}

export function useCancelAdminReservationMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      req,
    }: {
      reservationId: string;
      req: CancelReservationRequest;
    }) => {
      return await apiClient.cancelAdminReservation(propertyId, reservationId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all });
    },
  });
}

// Client Availability & Reservation Hooks
export function useClientReservations() {
  return useQuery<ReservationListResponse>({
    queryKey: ["client-reservations"],
    queryFn: async () => {
      try {
        return await apiClient.getClientReservations();
      } catch {
        return {
          items: INITIAL_RESERVATIONS,
        };
      }
    },
  });
}

export function useCreateClientHoldMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateClientHoldReservationRequest) => {
      return await apiClient.createClientHoldReservation(req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
    },
  });
}

export function useSubmitClientSlipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reservationId,
      req,
    }: {
      reservationId: string;
      req: SubmitReservationSlipRequest;
    }) => {
      return await apiClient.submitClientReservationSlip(reservationId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-reservations"] });
    },
  });
}
