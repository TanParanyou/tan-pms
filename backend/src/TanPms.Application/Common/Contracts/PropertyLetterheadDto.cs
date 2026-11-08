namespace TanPms.Application.Common.Contracts;

// Issuer block printed on contracts and receipts.
public sealed record PropertyLetterheadDto(
    string Code,
    LocalizedTextDto Name,
    LocalizedTextDto? Address,
    string TaxBranchCode);
