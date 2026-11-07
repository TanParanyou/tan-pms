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
}
