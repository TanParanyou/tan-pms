using TanPms.Application.Common.Results;

namespace TanPms.Application.Stays;

public interface IStayStore
{
    Result<StaySummaryDto> CheckInStay(
        CheckInStayCommand command,
        bool callerHasOverridePermission,
        DateTimeOffset? nowUtc = null);

    Result<StayListResponse> GetAdminStays(
        Guid propertyId,
        string? status,
        string? stayMode,
        bool unmaskPii = false,
        DateTimeOffset? nowUtc = null);

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
        DateTimeOffset? nowUtc = null);

    Result<StayDetailDto> CheckOutAdminStay(
        Guid propertyId,
        Guid stayId,
        CheckOutStayRequest request,
        DateTimeOffset? nowUtc = null);

    Result<RegulatoryExportResponse> GetAdminRegulatoryExport(
        Guid propertyId,
        string reportType,
        bool unmaskPii,
        DateTimeOffset? nowUtc = null);
}
