using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Files;

namespace TanPms.Application.Files;

public sealed class UploadAdminFileHandler
{
    private readonly IStoredFileStore _store;
    private readonly IFileStorage _storage;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UploadAdminFileHandler(IStoredFileStore store, IFileStorage storage, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _storage = storage;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<StoredFileDto> Handle(UploadAdminFileCommand command)
    {
        if (StoredFileRules.ParsePurpose(command.Purpose, out var purpose) is { } purposeError)
        {
            return Result<StoredFileDto>.Failure(purposeError);
        }

        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            command.PropertyId,
            StoredFileRules.AdminPermissionsFor(purpose)) is { } authError)
        {
            return Result<StoredFileDto>.Failure(authError);
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
            PropertyId = command.PropertyId,
            UploadedByUserId = _currentUser.UserId
        };
        _storage.Save(file.FileKey, bytes);
        var result = _store.AddStoredFile(file);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: StoredFileRules.AdminUploadActionKey,
                entityId: file.Id,
                reason: $"Uploaded {purpose} file",
                afterState: new { result.Value.FileKey, result.Value.Purpose, result.Value.ContentType, result.Value.Size });
        }

        return result;
    }
}
