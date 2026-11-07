using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Stays;

public sealed record RegulatoryExportResponse(
    PropertyRefDto Property,
    string ReportType,
    DateTimeOffset GeneratedAt,
    bool IsPiiUnmasked,
    string CsvContent,
    IReadOnlyList<RegulatoryGuestRowDto> Rows);
