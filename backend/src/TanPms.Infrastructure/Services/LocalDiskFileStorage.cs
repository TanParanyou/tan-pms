using TanPms.Application.Common.Abstractions;
using TanPms.Application.Files;
using TanPms.Domain.Common;

namespace TanPms.Infrastructure.Services;

// Private local-disk blob store (Storage:RootPath). Files are never served statically; only the authorized
// download endpoints stream them. Keys are re-validated here so no caller can escape the root folder.
public sealed class LocalDiskFileStorage : IFileStorage
{
    private readonly string _rootPath;

    public LocalDiskFileStorage(string rootPath)
    {
        _rootPath = Path.GetFullPath(rootPath);
        Directory.CreateDirectory(_rootPath);
    }

    public void Save(string fileKey, byte[] content)
    {
        var path = ResolvePath(fileKey);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllBytes(path, content);
    }

    public Stream? OpenRead(string fileKey)
    {
        var path = ResolvePath(fileKey);
        return File.Exists(path) ? File.OpenRead(path) : null;
    }

    private string ResolvePath(string fileKey)
    {
        if (!StoredFileRules.IsValidFileKey(fileKey))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Invalid file key.", httpStatus: 400);
        }

        // Two-char fan-out keeps directories small.
        return Path.Combine(_rootPath, fileKey[..2], fileKey);
    }
}
