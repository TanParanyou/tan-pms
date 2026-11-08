using TanPms.Domain.Common;

namespace TanPms.Domain.Files;

// Metadata of an uploaded file; the bytes live in IFileStorage under FileKey (server-generated, never user input).
public sealed class StoredFile : AuditableEntity
{
    public required string FileKey { get; init; }
    public required StoredFilePurpose Purpose { get; init; }
    public required string ContentType { get; init; }
    public required long SizeBytes { get; init; }
    public Guid? PropertyId { get; init; }
    public string? UploadedByUserId { get; init; }
    public Guid? UploadedByCustomerId { get; init; }
}
