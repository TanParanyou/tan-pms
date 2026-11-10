using TanPms.Application.Common.Models;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Stays;

public interface IStayStore
{
    Result<StaySummaryDto> CheckInStay(
        CheckInStayCommand command,
        bool callerHasOverridePermission,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null);

    Result<StayListResponse> GetAdminStays(
        Guid propertyId,
        string? status,
        string? stayMode,
        bool unmaskPii = false,
        DateTimeOffset? nowUtc = null,
        PageRequest? paging = null);

    Result<StayDetailDto> ExtendAdminStay(
        Guid propertyId,
        Guid stayId,
        ExtendStayRequest request,
        DateTimeOffset? nowUtc = null);

    Result<StayDetailDto> AddAdminFolioCharge(
        Guid propertyId,
        Guid stayId,
        AddFolioChargeRequest request,
        DateTimeOffset? nowUtc = null);

    Result<StayDetailDto> RecordAdminFolioPayment(
        Guid propertyId,
        Guid stayId,
        RecordFolioPaymentRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null);

    Result<StayDetailDto> CheckOutAdminStay(
        Guid propertyId,
        Guid stayId,
        CheckOutStayRequest request,
        DateTimeOffset? nowUtc = null,
        string? cashierUserId = null);

    Result<StayDetailDto> GetAdminStay(Guid propertyId, Guid stayId, bool unmaskPii = false, DateTimeOffset? nowUtc = null);

    Result<StayDetailDto> AddAdminStayOccupant(Guid propertyId, Guid stayId, CheckInOccupantInputDto request);

    Result<StayDetailDto> UpdateAdminStayOccupant(Guid propertyId, Guid stayId, Guid occupantId, UpdateStayOccupantRequest request);

    Result<StayDetailDto> DeleteAdminStayOccupant(Guid propertyId, Guid stayId, Guid occupantId);

    Result<StayDetailDto> UpdateAdminStay(Guid propertyId, Guid stayId, UpdateStayRequest request, DateTimeOffset? nowUtc = null);

    Result<StayDetailDto> VoidAdminFolioCharge(Guid propertyId, Guid stayId, Guid chargeId, ReasonRequest request);

    Result<StayDetailDto> ReverseAdminFolioPayment(Guid propertyId, Guid stayId, ReverseFolioPaymentRequest request, string? cashierUserId = null);

    Result<StayDetailDto> CancelAdminStay(Guid propertyId, Guid stayId, ReasonRequest request, string? cashierUserId = null, DateTimeOffset? nowUtc = null);

    Result<RegulatoryExportResponse> GetAdminRegulatoryExport(
        Guid propertyId,
        string reportType,
        bool unmaskPii,
        DateTimeOffset? nowUtc = null);
}
