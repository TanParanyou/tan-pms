namespace TanPms.Application.Properties;

public sealed record DeleteAdminFloorCommand(
    Guid PropertyId,
    Guid FloorId);
