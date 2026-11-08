using TanPms.Application.Common.Results;

namespace TanPms.Application.Parcels;

public interface IParcelStore
{
    Result<ParcelItemDto> ReceiveAdminParcel(Guid propertyId, ReceiveParcelRequest request, DateTimeOffset? nowUtc = null);

    Result<ParcelListResponse> GetAdminParcels(Guid propertyId, string? status, bool unmaskPii = false);

    Result<ParcelItemDto> PickUpAdminParcel(Guid propertyId, Guid parcelId, PickUpParcelRequest request, DateTimeOffset? nowUtc = null);

    Result<ParcelListResponse> GetClientParcels(Guid customerId, string? status);
}
