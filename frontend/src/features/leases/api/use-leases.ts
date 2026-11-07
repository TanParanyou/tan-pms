"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  LeaseItemDto,
  CustomerListResponse,
  LeaseListResponse,
  LeaseStatusType,
  CreateLeaseRequest,
  LeaseOccupantRequest,
  LeaseVehicleRequest,
  RenewLeaseRequest,
  SettleLeaseMoveOutRequest,
} from "../types";

export interface LeaseListFilters {
  status?: LeaseStatusType;
  licensePlate?: string;
}

export function useAdminLeases(propertyId: string, filters: LeaseListFilters = {}) {
  return useQuery<LeaseListResponse>({
    queryKey: queryKeys.leases.list(propertyId, filters.status, filters.licensePlate),
    queryFn: () => apiClient.getAdminLeases(propertyId, filters),
  });
}

export function useAdminLeaseDetail(propertyId: string, leaseId: string) {
  return useQuery<LeaseItemDto>({
    queryKey: queryKeys.leases.detail(propertyId, leaseId),
    queryFn: () => apiClient.getAdminLease(propertyId, leaseId),
  });
}

export function useAdminCustomerSearch(propertyId: string, search: string) {
  return useQuery<CustomerListResponse>({
    queryKey: queryKeys.customers.search(propertyId, search),
    queryFn: () => apiClient.searchAdminCustomers(propertyId, search),
  });
}

function useLeaseMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leases.all });
    },
  });
}

export function useCreateLeaseMutation(propertyId: string) {
  return useLeaseMutation((req: CreateLeaseRequest) => apiClient.createAdminLease(propertyId, req));
}

export function useAddLeaseOccupantMutation(propertyId: string) {
  return useLeaseMutation(({ leaseId, req }: { leaseId: string; req: LeaseOccupantRequest }) =>
    apiClient.addAdminLeaseOccupant(propertyId, leaseId, req)
  );
}

export function useAddLeaseVehicleMutation(propertyId: string) {
  return useLeaseMutation(({ leaseId, req }: { leaseId: string; req: LeaseVehicleRequest }) =>
    apiClient.addAdminLeaseVehicle(propertyId, leaseId, req)
  );
}

export function useRenewLeaseMutation(propertyId: string) {
  return useLeaseMutation(({ leaseId, req }: { leaseId: string; req: RenewLeaseRequest }) =>
    apiClient.renewAdminLease(propertyId, leaseId, req)
  );
}

export function useMoveOutNoticeMutation(propertyId: string) {
  return useLeaseMutation((leaseId: string) => apiClient.giveAdminLeaseMoveOutNotice(propertyId, leaseId));
}

export function useSettleMoveOutMutation(propertyId: string) {
  return useLeaseMutation(({ leaseId, req }: { leaseId: string; req: SettleLeaseMoveOutRequest }) =>
    apiClient.settleAdminLeaseMoveOut(propertyId, leaseId, req)
  );
}
