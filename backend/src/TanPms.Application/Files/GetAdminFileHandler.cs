using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;

namespace TanPms.Application.Files;

public sealed class GetAdminFileHandler
{
    private readonly IStoredFileStore _store;
    private readonly IFileStorage _storage;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminFileHandler(IStoredFileStore store, IFileStorage storage, ICurrentUserContext currentUser)
    {
        _store = store;
        _storage = storage;
        _currentUser = currentUser;
    }

    public Result<StoredFileContent> Handle(GetAdminFileQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminScope(_currentUser) is { } authError)
        {
            return Result<StoredFileContent>.Failure(authError);
        }

        var file = StoredFileRules.IsValidFileKey(query.FileKey) ? _store.FindStoredFile(query.FileKey) : null;
        if (file is null)
        {
            return Result<StoredFileContent>.Failure(StoredFileRules.FileNotFound(query.FileKey));
        }

        // Uploader, the property the file was uploaded for, or the property of any entity it is attached to.
        var allowed = file.UploadedByUserId == _currentUser.UserId
            || (file.PropertyId is { } propertyId && _currentUser.AllowedPropertyIds.Contains(propertyId))
            || _store.FindFileAttachmentPropertyIds(file.FileKey).Any(_currentUser.AllowedPropertyIds.Contains);
        if (!allowed)
        {
            return Result<StoredFileContent>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                "Caller does not have access to this file."));
        }

        var content = _storage.OpenRead(file.FileKey);
        return content is null
            ? Result<StoredFileContent>.Failure(StoredFileRules.FileNotFound(query.FileKey))
            : Result<StoredFileContent>.Success(new StoredFileContent(file.FileKey, file.ContentType, content));
    }
}
