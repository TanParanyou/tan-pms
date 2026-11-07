"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type { InvoiceListResponse, BatchInvoiceRunRequest } from "../types";

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
