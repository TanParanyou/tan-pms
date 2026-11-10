namespace TanPms.Application.Rates;

public sealed record DeleteAdminTaxProfileCommand(
    Guid PropertyId,
    Guid TaxProfileId);
