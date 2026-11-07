namespace TanPms.Application.Meters;

public sealed record SaveMeterReadingsResponse(
    string Period,
    bool IsSaved,
    IReadOnlyList<MeterReadingRowResultDto> Rows);
