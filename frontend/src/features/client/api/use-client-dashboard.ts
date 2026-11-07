"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { SAMPLE_HOLD_RESERVATION, SAMPLE_LEASE_DETAILS } from "../constants";
import type { ClientDashboardResponse } from "@/generated/api";

export function useClientDashboard() {
  const fallbackData: ClientDashboardResponse = {
    customer: {
      id: "cus-client-01",
      fullName: "Wipaporn Kaewmanee",
      maskedNationalId: "3-xxxx-xxxxx-11-8",
    },
    activeHoldReservation: {
      documentNumber: SAMPLE_HOLD_RESERVATION.documentNumber,
      unitTypeName: SAMPLE_HOLD_RESERVATION.unitTypeName,
      stayMode: SAMPLE_HOLD_RESERVATION.stayMode,
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      depositAmount: 1500,
    },
    activeLease: {
      documentNumber: SAMPLE_LEASE_DETAILS.leaseNumber,
      unit: SAMPLE_LEASE_DETAILS.unit,
      monthlyRentAmount: 12500,
      securityDepositBalance: 25000,
    },
    unpaidInvoices: [],
    pendingParcels: [],
  };

  return useQuery<ClientDashboardResponse>({
    queryKey: queryKeys.clientDashboard.summary(),
    queryFn: async () => {
      try {
        return await apiClient.getClientDashboard();
      } catch {
        return fallbackData;
      }
    },
    placeholderData: fallbackData,
  });
}
