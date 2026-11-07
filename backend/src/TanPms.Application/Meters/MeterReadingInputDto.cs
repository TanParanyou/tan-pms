namespace TanPms.Application.Meters;

public sealed record MeterReadingInputDto(
    Guid UnitId,
    decimal CurrentWaterReading,
    decimal CurrentElectricReading,
    bool WaterRolloverConfirmed = false,
    bool ElectricRolloverConfirmed = false,
    string? WaterPhotoFileKey = null,
    string? ElectricPhotoFileKey = null);
