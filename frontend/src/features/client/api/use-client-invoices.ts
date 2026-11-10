"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type PagingParams } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ReceiptListResponse } from "@/features/files/types";
import type {
  ClientInvoiceDto,
  ClientInvoiceListResponse,
  ClientPaymentSlipDto,
  ClientPaymentSlipListResponse,
  SubmitPaymentSlipRequest,
  ClientUtilityUsageResponse,
} from "../types";
import { invalidateClientCaches } from "./invalidate-client";

export function useClientInvoices(status?: string, paging: PagingParams = {}) {
  return useQuery<ClientInvoiceListResponse>({
    queryKey: [...queryKeys.clientPortal.invoices(status), paging],
    queryFn: () => apiClient.getClientInvoices({ status, ...paging }),
    placeholderData: keepPreviousData,
  });
}

export function useClientInvoice(invoiceId: string) {
  return useQuery<ClientInvoiceDto>({
    queryKey: queryKeys.clientPortal.invoice(invoiceId),
    queryFn: () => apiClient.getClientInvoice(invoiceId),
  });
}

export function useClientAllSlips(enabled = true, paging: PagingParams = {}) {
  return useQuery<ClientPaymentSlipListResponse>({
    queryKey: [...queryKeys.clientPortal.slips(), paging],
    queryFn: () => apiClient.getClientAllPaymentSlips(paging),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useSubmitSlipMutation() {
  const qc = useQueryClient();
  return useMutation<ClientPaymentSlipDto, Error, { invoiceId: string; req: SubmitPaymentSlipRequest }>({
    mutationFn: ({ invoiceId, req }) => apiClient.submitClientPaymentSlip(invoiceId, req),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useUpdateSlipMutation() {
  const qc = useQueryClient();
  return useMutation<
    ClientPaymentSlipDto,
    Error,
    { invoiceId: string; slipId: string; req: SubmitPaymentSlipRequest }
  >({
    mutationFn: ({ invoiceId, slipId, req }) => apiClient.updateClientPaymentSlip(invoiceId, slipId, req),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useWithdrawSlipMutation() {
  const qc = useQueryClient();
  return useMutation<ClientPaymentSlipDto, Error, { invoiceId: string; slipId: string }>({
    mutationFn: ({ invoiceId, slipId }) => apiClient.withdrawClientPaymentSlip(invoiceId, slipId),
    onSuccess: () => invalidateClientCaches(qc),
  });
}

export function useClientUtilityUsage(leaseId?: string, months?: number) {
  return useQuery<ClientUtilityUsageResponse>({
    queryKey: queryKeys.clientPortal.usage(leaseId, months),
    queryFn: () => apiClient.getClientUtilityUsage({ leaseId, months }),
  });
}

export function useClientReceipts(enabled = true) {
  return useQuery<ReceiptListResponse>({
    queryKey: queryKeys.clientPortal.receipts(),
    queryFn: () => apiClient.getClientReceipts(),
    enabled,
  });
}
