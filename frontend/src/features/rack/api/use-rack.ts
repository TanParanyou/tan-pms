"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { INITIAL_RACK_PROJECTIONS } from "../constants";
import { CENTRAL_PROPERTIES } from "@/constants/master-data";
import type { RoomRackResponse } from "@/generated/api";

export function useAdminRoomRack(propertyId: string) {
  const propertyRef = {
    id: propertyId,
    code: CENTRAL_PROPERTIES[0].code,
    name: { ...CENTRAL_PROPERTIES[0].name },
  };

  return useQuery<RoomRackResponse>({
    queryKey: queryKeys.rack.byProperty(propertyId),
    queryFn: async () => {
      try {
        return await apiClient.getAdminRoomRack(propertyId);
      } catch {
        return {
          property: propertyRef,
          items: INITIAL_RACK_PROJECTIONS,
        };
      }
    },
    placeholderData: {
      property: propertyRef,
      items: INITIAL_RACK_PROJECTIONS,
    },
  });
}
