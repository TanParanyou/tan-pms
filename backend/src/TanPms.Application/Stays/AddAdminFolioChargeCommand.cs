namespace TanPms.Application.Stays;

public sealed record AddAdminFolioChargeCommand(
    Guid PropertyId,
    Guid StayId,
    AddFolioChargeRequest Request);
