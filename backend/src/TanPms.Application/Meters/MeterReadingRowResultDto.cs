namespace TanPms.Application.Meters;

public sealed record MeterReadingRowResultDto(
    Guid UnitId,
    string? UnitNumber,
    bool IsLockedOverride,
    UtilityReadingResultDto? Water,
    UtilityReadingResultDto? Electric,
    IReadOnlyList<MeterReadingIssueDto> Errors,
    IReadOnlyList<MeterReadingIssueDto> Warnings);
