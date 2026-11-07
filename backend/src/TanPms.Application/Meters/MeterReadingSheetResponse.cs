namespace TanPms.Application.Meters;

public sealed record MeterReadingSheetResponse(
    string Period,
    IReadOnlyList<MeterReadingSheetRowDto> Rows);
