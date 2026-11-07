"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
import type {
  MeterReadingSheetResponse,
  SaveMeterReadingsRequest,
} from "@/features/billing/types";

export function useMeterReadingSheet(propertyId: string, period: string, buildingId?: string, enabled = true) {
  return useQuery<MeterReadingSheetResponse>({
    queryKey: queryKeys.meters.sheet(propertyId, period, buildingId),
    queryFn: () => apiClient.getAdminMeterReadingSheet(propertyId, { period, buildingId }),
    enabled,
  });
}

export function useSaveMeterReadingsMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: SaveMeterReadingsRequest) => apiClient.saveAdminMeterReadings(propertyId, req),
    // Only a persisted save changes downstream data; isSaved=false must leave caches alone.
    onSuccess: (res) => (res.isSaved ? invalidateOperationalCaches(queryClient) : undefined),
  });
}
