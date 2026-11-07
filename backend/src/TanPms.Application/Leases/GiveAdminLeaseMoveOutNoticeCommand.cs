namespace TanPms.Application.Leases;

public sealed record GiveAdminLeaseMoveOutNoticeCommand(
    Guid PropertyId,
    Guid LeaseId);
