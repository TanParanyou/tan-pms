namespace TanPms.Application.Meters;

public sealed record GetAdminMeterReadingSheetQuery(
    Guid PropertyId,
    string Period,
    Guid? BuildingId);
