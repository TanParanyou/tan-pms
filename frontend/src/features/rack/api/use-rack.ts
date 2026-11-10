"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { RoomRackResponse } from "@/generated/api";

export function useAdminRoomRack(propertyId: string) {
  return useQuery<RoomRackResponse>({
    queryKey: queryKeys.rack.byProperty(propertyId),
    queryFn: () => apiClient.getAdminRoomRack(propertyId),
  });
}
