namespace TanPms.Application.Meters;

public sealed record SaveMeterReadingsRequest(
    string Period,
    IReadOnlyList<MeterReadingInputDto> Items,
    string? OverrideReason = null);
