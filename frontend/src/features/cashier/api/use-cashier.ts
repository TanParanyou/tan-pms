"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type {
  CurrentCashierShiftResponse,
  CashierShiftListResponse,
  OpenCashierShiftRequest,
  CloseCashierShiftRequest,
  ReconcileCashierShiftRequest,
  CashierShiftDto,
} from "../types";

export function useCurrentCashierShift(propertyId: string) {
  return useQuery<CurrentCashierShiftResponse>({
    queryKey: queryKeys.cashier.current(propertyId),
    queryFn: () => apiClient.getAdminCurrentCashierShift(propertyId),
  });
}

export function useCashierShifts(propertyId: string, status?: string, paging: PagingParams = {}) {
  return useQuery<CashierShiftListResponse>({
    queryKey: [...queryKeys.cashier.shifts(propertyId, status), paging],
    queryFn: () => apiClient.getAdminCashierShifts(propertyId, { status, ...paging }),
    placeholderData: keepPreviousData,
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

export function useCashierShift(propertyId: string, shiftId: string | null) {
  return useQuery<CashierShiftDto>({
    queryKey: queryKeys.cashier.shift(propertyId, shiftId ?? ""),
    queryFn: () => apiClient.getAdminCashierShift(propertyId, shiftId ?? ""),
    enabled: shiftId !== null,
  });
}

export function useCancelShiftMutation(propertyId: string) {
  return useCashierMutation(({ shiftId, reason }: { shiftId: string; reason: string }) =>
    apiClient.cancelAdminCashierShift(propertyId, shiftId, reason)
  );
}

export function useUpdateShiftRemarkMutation(propertyId: string) {
  return useCashierMutation(({ shiftId, varianceRemark }: { shiftId: string; varianceRemark: string }) =>
    apiClient.updateAdminCashierShiftRemark(propertyId, shiftId, { varianceRemark })
  );
}
