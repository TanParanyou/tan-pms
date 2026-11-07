"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  INITIAL_RATE_PLANS,
  INITIAL_UTILITY_TARIFFS,
  INITIAL_TAX_PROFILES,
  SAMPLE_RATE_PROPERTY,
} from "../constants";
import type {
  PropertyRateCatalogResponse,
  RatePlanItemDto,
  UpsertRatePlanRequest,
  UpsertUtilityTariffRequest,
  UpsertTaxProfileRequest,
  RateSimulationRequest,
} from "@/generated/api";

export function usePropertyRates(propertyId: string) {
  return useQuery<PropertyRateCatalogResponse>({
    queryKey: queryKeys.rates.catalog(propertyId),
    queryFn: async () => {
      try {
        return await apiClient.getAdminPropertyRates(propertyId);
      } catch {
        return {
          property: {
            id: propertyId,
            code: SAMPLE_RATE_PROPERTY.code,
            name: SAMPLE_RATE_PROPERTY.name,
          },
          ratePlans: INITIAL_RATE_PLANS,
          utilityTariffs: INITIAL_UTILITY_TARIFFS,
          taxProfiles: INITIAL_TAX_PROFILES,
        };
      }
    },
    placeholderData: {
      property: {
        id: propertyId,
        code: SAMPLE_RATE_PROPERTY.code,
        name: SAMPLE_RATE_PROPERTY.name,
      },
      ratePlans: INITIAL_RATE_PLANS,
      utilityTariffs: INITIAL_UTILITY_TARIFFS,
      taxProfiles: INITIAL_TAX_PROFILES,
    },
  });
}

export function useRatePlanDetail(propertyId: string, ratePlanId: string) {
  return useQuery<RatePlanItemDto | null>({
    queryKey: queryKeys.rates.detail(ratePlanId),
    queryFn: async () => {
      try {
        const catalog = await apiClient.getAdminPropertyRates(propertyId);
        return catalog.ratePlans.find((rp) => rp.id === ratePlanId || rp.code === ratePlanId) ?? null;
      } catch {
        const fallback = INITIAL_RATE_PLANS.find((rp) => rp.id === ratePlanId || rp.code === ratePlanId);
        return fallback ?? INITIAL_RATE_PLANS[0] ?? null;
      }
    },
    enabled: Boolean(ratePlanId && ratePlanId !== "create"),
  });
}

export function useUpsertRatePlanMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: UpsertRatePlanRequest) => {
      return await apiClient.upsertAdminRatePlan(propertyId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rates.all });
    },
  });
}

export function useUpsertUtilityTariffMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: UpsertUtilityTariffRequest) => {
      return await apiClient.upsertAdminUtilityTariff(propertyId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rates.all });
    },
  });
}

export function useUpsertTaxProfileMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: UpsertTaxProfileRequest) => {
      return await apiClient.upsertAdminTaxProfile(propertyId, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rates.all });
    },
  });
}

export function useSimulateRateMutation(propertyId: string) {
  return useMutation({
    mutationFn: async (req: RateSimulationRequest) => {
      return await apiClient.simulateAdminRateAndTax(propertyId, req);
    },
  });
}
