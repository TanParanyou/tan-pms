namespace TanPms.Application.Billing;

public sealed record UpdateAdminBillingSettingsCommand(
    Guid PropertyId,
    UpdateBillingSettingsRequest Request);
