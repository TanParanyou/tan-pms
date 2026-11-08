"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { ReceiptListResponse } from "@/features/files/types";
import type { InvoiceItemDto, InvoiceLineRequest, InvoiceListResponse, BatchInvoiceRunRequest } from "../types";

export function useAdminInvoices(propertyId: string, period: string, status?: string, enabled = true) {
  return useQuery<InvoiceListResponse>({
    queryKey: queryKeys.billing.invoices(propertyId, period, status),
    queryFn: () => apiClient.getAdminInvoices(propertyId, { period, status }),
    enabled,
  });
}

function useBillingMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateOperationalCaches(queryClient),
  });
}

export function useRunBatchInvoicesMutation(propertyId: string) {
  return useBillingMutation((req: BatchInvoiceRunRequest) => apiClient.runAdminBatchInvoices(propertyId, req));
}

export function useIssueInvoicesForPeriodMutation(propertyId: string) {
  return useBillingMutation((period: string) => apiClient.issueAdminInvoicesForPeriod(propertyId, { period }));
}

export function useIssueInvoiceMutation(propertyId: string) {
  return useBillingMutation((invoiceId: string) => apiClient.issueAdminInvoice(propertyId, invoiceId));
}

export function useDeleteInvoiceMutation(propertyId: string) {
  return useBillingMutation((invoiceId: string) => apiClient.deleteAdminInvoice(propertyId, invoiceId));
}

export function useAdminInvoice(propertyId: string, invoiceId: string | null) {
  return useQuery<InvoiceItemDto>({
    queryKey: queryKeys.billing.invoice(propertyId, invoiceId ?? ""),
    queryFn: () => apiClient.getAdminInvoice(propertyId, invoiceId ?? ""),
    enabled: invoiceId !== null,
  });
}

export function useAddInvoiceLineMutation(propertyId: string) {
  return useBillingMutation(({ invoiceId, req }: { invoiceId: string; req: InvoiceLineRequest }) =>
    apiClient.addAdminInvoiceLine(propertyId, invoiceId, req)
  );
}

export function useUpdateInvoiceLineMutation(propertyId: string) {
  return useBillingMutation(
    ({ invoiceId, lineId, req }: { invoiceId: string; lineId: string; req: InvoiceLineRequest }) =>
      apiClient.updateAdminInvoiceLine(propertyId, invoiceId, lineId, req)
  );
}

export function useDeleteInvoiceLineMutation(propertyId: string) {
  return useBillingMutation(({ invoiceId, lineId }: { invoiceId: string; lineId: string }) =>
    apiClient.deleteAdminInvoiceLine(propertyId, invoiceId, lineId)
  );
}

export function useVoidInvoiceMutation(propertyId: string) {
  return useBillingMutation(({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
    apiClient.voidAdminInvoice(propertyId, invoiceId, reason)
  );
}

export function useAdminReceipts(propertyId: string, invoiceId: string) {
  return useQuery<ReceiptListResponse>({
    queryKey: ["admin-receipts", propertyId, invoiceId],
    queryFn: () => apiClient.listAdminReceipts(propertyId, { invoiceId }),
  });
}
