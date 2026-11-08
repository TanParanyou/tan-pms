namespace TanPms.Application.Meters;

public sealed record DeleteAdminMeterReadingCommand(
    Guid PropertyId,
    Guid UnitId,
    string Period,
    string? OverrideReason);
