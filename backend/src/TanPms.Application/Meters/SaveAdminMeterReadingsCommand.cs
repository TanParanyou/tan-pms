namespace TanPms.Application.Meters;

public sealed record SaveAdminMeterReadingsCommand(
    Guid PropertyId,
    SaveMeterReadingsRequest Request);
