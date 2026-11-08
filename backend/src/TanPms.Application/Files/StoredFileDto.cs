namespace TanPms.Application.Files;

public sealed record StoredFileDto(
    string FileKey,
    string Purpose,
    string ContentType,
    long Size,
    DateTimeOffset CreatedAt);
