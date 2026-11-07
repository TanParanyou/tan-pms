namespace TanPms.Application.Stays;

public sealed record RecordAdminFolioPaymentCommand(
    Guid PropertyId,
    Guid StayId,
    RecordFolioPaymentRequest Request);
