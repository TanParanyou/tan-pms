using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;

namespace TanPms.Application.Files;

public sealed class GetClientFileHandler
{
    private readonly IStoredFileStore _store;
    private readonly IFileStorage _storage;
    private readonly ICurrentUserContext _currentUser;

    public GetClientFileHandler(IStoredFileStore store, IFileStorage storage, ICurrentUserContext currentUser)
    {
        _store = store;
        _storage = storage;
        _currentUser = currentUser;
    }

    public Result<StoredFileContent> Handle(GetClientFileQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<StoredFileContent>.Failure(authError);
        }

        var file = StoredFileRules.IsValidFileKey(query.FileKey) ? _store.FindStoredFile(query.FileKey) : null;
        if (file is null
            || (file.UploadedByCustomerId != customerId && !_store.IsFileAttachedToCustomer(file.FileKey, customerId)))
        {
            // Same answer for "missing" and "someone else's" so keys of other customers cannot be probed.
            return Result<StoredFileContent>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "File was not found for the current customer."));
        }

        var content = _storage.OpenRead(file.FileKey);
        return content is null
            ? Result<StoredFileContent>.Failure(StoredFileRules.FileNotFound(query.FileKey))
            : Result<StoredFileContent>.Success(new StoredFileContent(file.FileKey, file.ContentType, content));
    }
}
