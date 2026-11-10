namespace TanPms.Application.Billing;

public sealed record BillingSettingsDto(
    Guid PropertyId,
    int? PaymentTermsDays,
    int EffectivePaymentTermsDays);
