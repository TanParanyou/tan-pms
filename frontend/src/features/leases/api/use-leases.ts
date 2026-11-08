"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { invalidateOperationalCaches } from "@/lib/api/invalidate-operational";
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
  UpdateLeaseRequest,
  UpdateLeaseOccupantRequest,
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
    placeholderData: keepPreviousData,
  });
}

function useLeaseMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Lease changes alter unit occupancy: refresh dependent caches before the UI moves on.
    onSuccess: () =>
      Promise.all(
        [
          queryKeys.leases.all,
          queryKeys.properties.all,
          queryKeys.rack.all,
          queryKeys.availability.all,
          queryKeys.stays.all,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      ),
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

export function useUpdateLeaseMutation(propertyId: string) {
  return useLeaseMutation(({ leaseId, req }: { leaseId: string; req: UpdateLeaseRequest }) =>
    apiClient.updateAdminLease(propertyId, leaseId, req)
  );
}

/** Cancelling a lease can release deposits and void invoices: refresh every operational cache. */
export function useCancelLeaseMutation(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, reason }: { leaseId: string; reason: string }) =>
      apiClient.cancelAdminLease(propertyId, leaseId, reason),
    onSuccess: () => invalidateOperationalCaches(queryClient),
  });
}

export function useUpdateLeaseOccupantMutation(propertyId: string) {
  return useLeaseMutation(
    ({ leaseId, occupantId, req }: { leaseId: string; occupantId: string; req: UpdateLeaseOccupantRequest }) =>
      apiClient.updateAdminLeaseOccupant(propertyId, leaseId, occupantId, req)
  );
}

export function useDeleteLeaseOccupantMutation(propertyId: string) {
  return useLeaseMutation(({ leaseId, occupantId }: { leaseId: string; occupantId: string }) =>
    apiClient.deleteAdminLeaseOccupant(propertyId, leaseId, occupantId)
  );
}

export function useUpdateLeaseVehicleMutation(propertyId: string) {
  return useLeaseMutation(
    ({ leaseId, vehicleId, req }: { leaseId: string; vehicleId: string; req: LeaseVehicleRequest }) =>
      apiClient.updateAdminLeaseVehicle(propertyId, leaseId, vehicleId, req)
  );
}

export function useDeleteLeaseVehicleMutation(propertyId: string) {
  return useLeaseMutation(({ leaseId, vehicleId }: { leaseId: string; vehicleId: string }) =>
    apiClient.deleteAdminLeaseVehicle(propertyId, leaseId, vehicleId)
  );
}
