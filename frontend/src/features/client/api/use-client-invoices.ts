"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ClientInvoiceDto,
  ClientInvoiceListResponse,
  ClientPaymentSlipDto,
  ClientPaymentSlipListResponse,
  SubmitPaymentSlipRequest,
  ClientUtilityUsageResponse,
} from "../types";
import { invalidateClientCaches } from "./invalidate-client";

export function useClientInvoices(status?: string) {
  return useQuery<ClientInvoiceListResponse>({
    queryKey: queryKeys.clientPortal.invoices(status),
    queryFn: () => apiClient.getClientInvoices({ status }),
  });
}

export function useClientInvoice(invoiceId: string) {
  return useQuery<ClientInvoiceDto>({
    queryKey: queryKeys.clientPortal.invoice(invoiceId),
    queryFn: () => apiClient.getClientInvoice(invoiceId),
  });
}

export function useClientAllSlips(enabled = true) {
  return useQuery<ClientPaymentSlipListResponse>({
    queryKey: queryKeys.clientPortal.slips(),
    queryFn: () => apiClient.getClientAllPaymentSlips(),
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
