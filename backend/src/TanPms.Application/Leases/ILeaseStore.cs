using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Leases;

public interface ILeaseStore
{
    Result<LeaseListResponse> GetAdminLeases(
        Guid propertyId,
        string? status,
        string? licensePlate,
        bool unmaskPii = false);

    Result<LeaseItemDto> GetAdminLease(
        Guid propertyId,
        Guid leaseId,
        bool unmaskPii = false);

    Result<LeaseContractDto> GetAdminLeaseContract(
        Guid propertyId,
        Guid leaseId,
        bool unmaskPii = false);

    Result<LeaseItemDto> CreateAdminLease(
        Guid propertyId,
        CreateLeaseRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null);

    Result<LeaseItemDto> AddAdminLeaseOccupant(
        Guid propertyId,
        Guid leaseId,
        LeaseOccupantRequest request);

    Result<LeaseItemDto> AddAdminLeaseVehicle(
        Guid propertyId,
        Guid leaseId,
        LeaseVehicleRequest request);

    Result<LeaseItemDto> UpdateAdminLease(
        Guid propertyId,
        Guid leaseId,
        UpdateLeaseRequest request);

    Result<LeaseItemDto> UpdateAdminLeaseOccupant(
        Guid propertyId,
        Guid leaseId,
        Guid occupantId,
        UpdateLeaseOccupantRequest request);

    Result<LeaseItemDto> DeleteAdminLeaseOccupant(
        Guid propertyId,
        Guid leaseId,
        Guid occupantId);

    Result<LeaseItemDto> UpdateAdminLeaseVehicle(
        Guid propertyId,
        Guid leaseId,
        Guid vehicleId,
        LeaseVehicleRequest request);

    Result<LeaseItemDto> DeleteAdminLeaseVehicle(
        Guid propertyId,
        Guid leaseId,
        Guid vehicleId);

    Result<LeaseSettlementDto> CancelAdminLease(
        Guid propertyId,
        Guid leaseId,
        ReasonRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null);

    Result<LeaseItemDto> RenewAdminLease(
        Guid propertyId,
        Guid leaseId,
        RenewLeaseRequest request,
        DateTimeOffset? nowUtc = null);

    Result<LeaseItemDto> GiveAdminLeaseMoveOutNotice(
        Guid propertyId,
        Guid leaseId);

    Result<LeaseSettlementDto> SettleAdminLeaseMoveOut(
        Guid propertyId,
        Guid leaseId,
        SettleLeaseMoveOutRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null);
}
