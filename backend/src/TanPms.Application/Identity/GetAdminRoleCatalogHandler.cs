using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

public sealed class GetAdminRoleCatalogHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminRoleCatalogHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RoleCatalogResponse> Handle(GetAdminRoleCatalogQuery _)
    {
        if (!_currentUser.IsAdminScope)
        {
            return Result<RoleCatalogResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires AdminScope authorization."));
        }

        return _store.GetRoleCatalog();
    }
}
