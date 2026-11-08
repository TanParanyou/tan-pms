namespace TanPms.Application.Files;

public sealed record StoredFileContent(
    string FileKey,
    string ContentType,
    Stream Content);
