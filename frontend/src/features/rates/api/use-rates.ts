"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type {
  PropertyRateCatalogResponse,
  RatePlanItemDto,
  UtilityTariffItemDto,
  TaxProfileItemDto,
  UpsertRatePlanRequest,
  UpsertUtilityTariffRequest,
  UpsertTaxProfileRequest,
  RateSimulationRequest,
} from "@/generated/api";

export function usePropertyRates(propertyId: string) {
  return useQuery<PropertyRateCatalogResponse>({
    queryKey: queryKeys.rates.catalog(propertyId),
    queryFn: () => apiClient.getAdminPropertyRates(propertyId),
  });
}

export function useRatePlanDetail(propertyId: string, ratePlanId: string) {
  return useQuery<RatePlanItemDto>({
    queryKey: [...queryKeys.rates.detail(ratePlanId), propertyId],
    queryFn: () => apiClient.getAdminRatePlan(propertyId, ratePlanId),
    enabled: Boolean(ratePlanId && ratePlanId !== "create"),
  });
}

export function useUtilityTariffDetail(propertyId: string, id: string | null) {
  return useQuery<UtilityTariffItemDto>({
    queryKey: [...queryKeys.rates.all, "tariff", propertyId, id],
    queryFn: () => apiClient.getAdminUtilityTariff(propertyId, id as string),
    enabled: Boolean(id),
  });
}

export function useTaxProfileDetail(propertyId: string, id: string | null) {
  return useQuery<TaxProfileItemDto>({
    queryKey: [...queryKeys.rates.all, "tax", propertyId, id],
    queryFn: () => apiClient.getAdminTaxProfile(propertyId, id as string),
    enabled: Boolean(id),
  });
}

// Rates drive quotes, availability and billing: await every dependent cache.
function useRateMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rates.all }),
        queryClient.invalidateQueries({ queryKey: ["admin-rate-plan-detail"] }),
        invalidateOperationalCaches(queryClient),
      ]);
    },
  });
}

export function useUpsertRatePlanMutation(propertyId: string) {
  return useRateMutation((req: UpsertRatePlanRequest) => apiClient.upsertAdminRatePlan(propertyId, req));
}
export function useDeleteRatePlanMutation(propertyId: string) {
  return useRateMutation((id: string) => apiClient.deleteAdminRatePlan(propertyId, id));
}
export function useUpsertUtilityTariffMutation(propertyId: string) {
  return useRateMutation((req: UpsertUtilityTariffRequest) => apiClient.upsertAdminUtilityTariff(propertyId, req));
}
export function useDeleteUtilityTariffMutation(propertyId: string) {
  return useRateMutation((id: string) => apiClient.deleteAdminUtilityTariff(propertyId, id));
}
export function useUpsertTaxProfileMutation(propertyId: string) {
  return useRateMutation((req: UpsertTaxProfileRequest) => apiClient.upsertAdminTaxProfile(propertyId, req));
}
export function useDeleteTaxProfileMutation(propertyId: string) {
  return useRateMutation((id: string) => apiClient.deleteAdminTaxProfile(propertyId, id));
}

export function useSimulateRateMutation(propertyId: string) {
  return useMutation({
    mutationFn: (req: RateSimulationRequest) => apiClient.simulateAdminRateAndTax(propertyId, req),
  });
}
