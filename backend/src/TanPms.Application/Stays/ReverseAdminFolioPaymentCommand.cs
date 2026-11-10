namespace TanPms.Application.Stays;

public sealed record ReverseAdminFolioPaymentCommand(
    Guid PropertyId,
    Guid StayId,
    ReverseFolioPaymentRequest Request);
