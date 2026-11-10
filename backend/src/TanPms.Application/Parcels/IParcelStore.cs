using TanPms.Application.Common.Models;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Parcels;

public interface IParcelStore
{
    Result<ParcelItemDto> ReceiveAdminParcel(Guid propertyId, ReceiveParcelRequest request, DateTimeOffset? nowUtc = null);

    Result<ParcelListResponse> GetAdminParcels(Guid propertyId, string? status, bool unmaskPii = false, PageRequest? paging = null);

    Result<ParcelItemDto> PickUpAdminParcel(Guid propertyId, Guid parcelId, PickUpParcelRequest request, DateTimeOffset? nowUtc = null);

    Result<ParcelListResponse> GetClientParcels(Guid customerId, string? status, PageRequest? paging = null);

    Result<ParcelItemDto> GetAdminParcel(Guid propertyId, Guid parcelId, bool unmaskPii = false);

    Result<ParcelItemDto> GetClientParcel(Guid customerId, Guid parcelId);

    Result<ParcelItemDto> UpdateAdminParcel(Guid propertyId, Guid parcelId, ReceiveParcelRequest request);

    Result<ParcelItemDto> VoidAdminParcel(Guid propertyId, Guid parcelId, ReasonRequest request);
}
