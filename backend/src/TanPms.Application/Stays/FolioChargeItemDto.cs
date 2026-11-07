using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Stays;

public sealed record FolioChargeItemDto(
    Guid Id,
    LocalizedTextDto Description,
    decimal Amount,
    string TaxMode);
