using TanPms.Application.Common.Results;

namespace TanPms.Application.Meters;

public interface IMeterReadingStore
{
    Result<MeterReadingSheetResponse> GetAdminMeterReadingSheet(
        Guid propertyId,
        string period,
        Guid? buildingId);

    Result<SaveMeterReadingsResponse> SaveAdminMeterReadings(
        Guid propertyId,
        SaveMeterReadingsRequest request,
        bool callerCanOverrideLocked);

    // leaseId null = the customer's most recent Active/MoveOutNotice lease.
    Result<ClientUtilityUsageResponse> GetClientUtilityUsage(Guid customerId, Guid? leaseId, int months);

    Result<MeterReadingSheetRowDto> DeleteAdminMeterReading(
        Guid propertyId,
        Guid unitId,
        string period,
        string? overrideReason,
        bool callerCanOverrideLocked);
}
