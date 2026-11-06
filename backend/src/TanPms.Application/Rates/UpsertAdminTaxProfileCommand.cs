namespace TanPms.Application.Rates;

public sealed record UpsertAdminTaxProfileCommand(
    Guid PropertyId,
    UpsertTaxProfileRequest Request);
