using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Identity;

public sealed class GetCurrentAuthSessionHandler
{
    private readonly IIdentityStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetCurrentAuthSessionHandler(IIdentityStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<AuthSessionResponse> Handle(GetCurrentAuthSessionQuery _) =>
        _store.GetCurrentAuthSession(_currentUser);
}
