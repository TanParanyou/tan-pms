"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  OccupancyReportDto,
  RevParReportDto,
  AgingReportDto,
  CashierShiftSummaryDto,
  DepositSummaryDto,
  AnalyticsReportKind,
} from "@/features/client/types";

function useReport<T>(propertyId: string, report: AnalyticsReportKind, from: string, to: string, enabled: boolean) {
  return useQuery<T>({
    queryKey: queryKeys.analytics.report(propertyId, report, from, to),
    queryFn: () => apiClient.getAdminAnalytics<T>(propertyId, report, { from, to }),
    enabled,
  });
}

export const useOccupancyReport = (p: string, from: string, to: string, enabled: boolean) =>
  useReport<OccupancyReportDto>(p, "occupancy", from, to, enabled);
export const useRevParReport = (p: string, from: string, to: string, enabled: boolean) =>
  useReport<RevParReportDto>(p, "revpar", from, to, enabled);
export const useAgingReport = (p: string, from: string, to: string, enabled: boolean) =>
  useReport<AgingReportDto>(p, "receivables-aging", from, to, enabled);
export const useCashierSummaryReport = (p: string, from: string, to: string, enabled: boolean) =>
  useReport<CashierShiftSummaryDto>(p, "cashier-shifts", from, to, enabled);
export const useDepositSummaryReport = (p: string, from: string, to: string, enabled: boolean) =>
  useReport<DepositSummaryDto>(p, "deposits", from, to, enabled);
