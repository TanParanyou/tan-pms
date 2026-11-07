namespace TanPms.Application.Meters;

public sealed record MeterReadingIssueDto(
    string Code,
    string? UtilityType);
