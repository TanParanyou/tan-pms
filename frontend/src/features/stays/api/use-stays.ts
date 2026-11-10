"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type {
  StayListResponse,
  StayDetailDto,
  CheckInStayRequest,
  ExtendStayRequest,
  AddFolioChargeRequest,
  RecordFolioPaymentRequest,
  CheckOutStayRequest,
  RegulatoryExportResponse,
} from "@/generated/api";
import type { ReceiptItemDto } from "@/features/files/types";
import type {
  UpdateStayRequest,
  UpdateStayOccupantRequest,
  ReverseFolioPaymentRequest,
  CheckInOccupantInputDto,
} from "@/features/client/types";

export function useAdminStays(propertyId: string, filters: { status?: string; stayMode?: string } = {}, paging: PagingParams = {}) {
  return useQuery<StayListResponse>({
    queryKey: [...queryKeys.stays.list(propertyId, filters.status, filters.stayMode), paging],
    queryFn: () => apiClient.getAdminStays(propertyId, { ...filters, ...paging }),
    placeholderData: keepPreviousData,
  });
}

/** Receipts for the stay's payments: the list endpoint has no stay filter, so keep only the rows the server tagged with this stayId. */
export function useStayReceipts(propertyId: string, stayId: string) {
  return useQuery<ReceiptItemDto[]>({
    queryKey: [...queryKeys.stays.detail(stayId), "receipts", propertyId],
    queryFn: async () => (await apiClient.listAdminReceipts(propertyId)).items.filter((r) => r.stayId === stayId),
  });
}

export function useAdminStayDetail(propertyId: string, stayId: string) {
  return useQuery<StayDetailDto>({
    queryKey: [...queryKeys.stays.detail(stayId), propertyId],
    queryFn: () => apiClient.getAdminStay(propertyId, stayId),
    enabled: Boolean(stayId && stayId !== "create"),
  });
}

// Stay changes hit folio, key deposit, rack and housekeeping: await every operational cache plus stay details.
function useStayMutation<TVars, TResult = unknown>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-stay-detail"] }),
        invalidateOperationalCaches(queryClient),
      ]);
    },
  });
}

export function useCheckInStayMutation() {
  return useStayMutation((req: CheckInStayRequest) => apiClient.checkInStay(req));
}
export function useUpdateStayMutation(propertyId: string) {
  return useStayMutation(({ id, req }: { id: string; req: UpdateStayRequest }) => apiClient.updateAdminStay(propertyId, id, req));
}
export function useCancelStayMutation(propertyId: string) {
  return useStayMutation(({ id, reason }: { id: string; reason: string }) => apiClient.cancelAdminStay(propertyId, id, reason));
}
export function useExtendStayMutation(propertyId: string) {
  return useStayMutation(({ stayId, req }: { stayId: string; req: ExtendStayRequest }) => apiClient.extendAdminStay(propertyId, stayId, req));
}
export function useAddFolioChargeMutation(propertyId: string) {
  return useStayMutation(({ stayId, req }: { stayId: string; req: AddFolioChargeRequest }) => apiClient.addAdminFolioCharge(propertyId, stayId, req));
}
export function useVoidFolioChargeMutation(propertyId: string) {
  return useStayMutation(({ stayId, chargeId, reason }: { stayId: string; chargeId: string; reason: string }) =>
    apiClient.voidAdminFolioCharge(propertyId, stayId, chargeId, reason)
  );
}
export function useRecordFolioPaymentMutation(propertyId: string) {
  return useStayMutation(({ stayId, req }: { stayId: string; req: RecordFolioPaymentRequest }) => apiClient.recordAdminFolioPayment(propertyId, stayId, req));
}
export function useReverseFolioPaymentMutation(propertyId: string) {
  return useStayMutation(({ stayId, req }: { stayId: string; req: ReverseFolioPaymentRequest }) => apiClient.reverseAdminFolioPayment(propertyId, stayId, req));
}
export function useCheckOutStayMutation(propertyId: string) {
  return useStayMutation(({ stayId, req }: { stayId: string; req: CheckOutStayRequest }) => apiClient.checkOutAdminStay(propertyId, stayId, req));
}
export function useAddStayOccupantMutation(propertyId: string) {
  return useStayMutation(({ stayId, req }: { stayId: string; req: CheckInOccupantInputDto }) => apiClient.addAdminStayOccupant(propertyId, stayId, req));
}
export function useUpdateStayOccupantMutation(propertyId: string) {
  return useStayMutation(({ stayId, occupantId, req }: { stayId: string; occupantId: string; req: UpdateStayOccupantRequest }) =>
    apiClient.updateAdminStayOccupant(propertyId, stayId, occupantId, req)
  );
}
export function useDeleteStayOccupantMutation(propertyId: string) {
  return useStayMutation(({ stayId, occupantId }: { stayId: string; occupantId: string }) =>
    apiClient.deleteAdminStayOccupant(propertyId, stayId, occupantId)
  );
}

export function useRegulatoryExportQuery(
  propertyId: string,
  params: { reportType: "RR4" | "TM30"; unmaskPii: boolean } | null
) {
  return useQuery<RegulatoryExportResponse>({
    queryKey: [...queryKeys.regulatoryExports.all, propertyId, params?.reportType ?? "", params?.unmaskPii ?? false],
    queryFn: () => apiClient.getAdminRegulatoryExports(propertyId, params as { reportType: "RR4" | "TM30"; unmaskPii: boolean }),
    enabled: params !== null,
    gcTime: 0, // exports may contain unmasked PII: never keep them cached
  });
}
