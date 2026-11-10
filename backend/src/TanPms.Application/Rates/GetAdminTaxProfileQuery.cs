namespace TanPms.Application.Rates;

public sealed record GetAdminTaxProfileQuery(
    Guid PropertyId,
    Guid TaxProfileId);
