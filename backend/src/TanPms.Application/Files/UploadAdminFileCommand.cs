namespace TanPms.Application.Files;

public sealed record UploadAdminFileCommand(
    Guid PropertyId,
    string Purpose,
    Stream Content);
