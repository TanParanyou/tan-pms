using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

public sealed class GetCurrentAuthSessionHandler
{
    private readonly IAuthStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetCurrentAuthSessionHandler(IAuthStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AuthSessionResponse> Handle(GetCurrentAuthSessionQuery _)
    {
        if (string.IsNullOrWhiteSpace(_currentUser.UserId) || (!_currentUser.IsAdminScope && !_currentUser.IsClientScope))
        {
            return Result<AuthSessionResponse>.Failure(new Error(DomainErrorCodes.Unauthenticated, "Caller is not authenticated."));
        }

        return _store.BuildAuthSession(_currentUser.IsAdminScope ? AuthScopes.Admin : AuthScopes.Client, _currentUser.UserId);
    }
}
