namespace TanPms.Application.Billing;

public sealed record UpdateBillingSettingsRequest(
    int? PaymentTermsDays);
