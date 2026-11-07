using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Meters;

public sealed record MeterReadingSheetRowDto(
    UnitRefDto Unit,
    Guid LeaseId,
    string LeaseDocumentNumber,
    CustomerRefDto Customer,
    int OccupantCount,
    bool IsLocked,
    UtilityReadingDto Water,
    UtilityReadingDto Electric);
