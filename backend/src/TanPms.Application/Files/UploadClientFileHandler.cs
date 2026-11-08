using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Files;

namespace TanPms.Application.Files;

public sealed class UploadClientFileHandler
{
    private readonly IStoredFileStore _store;
    private readonly IFileStorage _storage;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UploadClientFileHandler(IStoredFileStore store, IFileStorage storage, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _storage = storage;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StoredFileDto> Handle(UploadClientFileCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<StoredFileDto>.Failure(authError);
        }

        if (StoredFileRules.ParsePurpose(command.Purpose, out var purpose) is { } purposeError)
        {
            return Result<StoredFileDto>.Failure(purposeError);
        }

        if (!StoredFileRules.ClientPurposes.Contains(purpose))
        {
            return Result<StoredFileDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Clients may not upload {purpose} files."));
        }

        if (StoredFileRules.ReadContent(command.Content, out var bytes, out var contentType) is { } contentError)
        {
            return Result<StoredFileDto>.Failure(contentError);
        }

        var file = new StoredFile
        {
            FileKey = StoredFileRules.NewFileKey(),
            Purpose = purpose,
            ContentType = contentType,
            SizeBytes = bytes.LongLength,
            UploadedByCustomerId = customerId
        };
        _storage.Save(file.FileKey, bytes);
        var result = _store.AddStoredFile(file);
        if (result.IsSuccess && result.Value is not null)
        {
            // Client uploads are not property-bound yet; Guid.Empty marks the audit row as customer-originated.
            _auditLogger.RecordMutation(
                propertyId: Guid.Empty,
                actionKey: StoredFileRules.ClientUploadActionKey,
                entityId: file.Id,
                reason: $"Client uploaded {purpose} file",
                afterState: new { result.Value.FileKey, result.Value.Purpose, result.Value.ContentType, result.Value.Size, CustomerId = customerId });
        }

        return result;
    }
}
