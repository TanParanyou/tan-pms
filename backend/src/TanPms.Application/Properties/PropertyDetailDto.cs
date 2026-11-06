using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record PropertyDetailDto(
    Guid Id,
    string Code,
    string TaxBranchCode,
    LocalizedTextDto Name,
    LocalizedTextDto? Address);
