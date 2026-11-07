using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Stays;

public sealed record AddFolioChargeRequest(
    LocalizedTextDto Description,
    decimal Amount,
    string TaxMode);
