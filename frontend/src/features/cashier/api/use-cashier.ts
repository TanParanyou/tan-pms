"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type {
  CurrentCashierShiftResponse,
  CashierShiftListResponse,
  OpenCashierShiftRequest,
  CloseCashierShiftRequest,
  ReconcileCashierShiftRequest,
} from "../types";

export function useCurrentCashierShift(propertyId: string) {
  return useQuery<CurrentCashierShiftResponse>({
    queryKey: queryKeys.cashier.current(propertyId),
    queryFn: () => apiClient.getAdminCurrentCashierShift(propertyId),
  });
}

export function useCashierShifts(propertyId: string, status?: string) {
  return useQuery<CashierShiftListResponse>({
    queryKey: queryKeys.cashier.shifts(propertyId, status),
    queryFn: () => apiClient.getAdminCashierShifts(propertyId, { status }),
  });
}

function useCashierMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateOperationalCaches(queryClient),
  });
}

export function useOpenShiftMutation(propertyId: string) {
  return useCashierMutation((req: OpenCashierShiftRequest) => apiClient.openAdminCashierShift(propertyId, req));
}

export function useCloseShiftMutation(propertyId: string) {
  return useCashierMutation(({ shiftId, req }: { shiftId: string; req: CloseCashierShiftRequest }) =>
    apiClient.closeAdminCashierShift(propertyId, shiftId, req)
  );
}

export function useReconcileShiftMutation(propertyId: string) {
  return useCashierMutation(({ shiftId, req }: { shiftId: string; req: ReconcileCashierShiftRequest }) =>
    apiClient.reconcileAdminCashierShift(propertyId, shiftId, req)
  );
}
