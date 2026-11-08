namespace TanPms.Application.Files;

public sealed record UploadClientFileCommand(
    string Purpose,
    Stream Content);
