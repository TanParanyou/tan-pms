using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Identity;

namespace TanPms.WebApi.Security;

// Trusts only the validated bearer token's subject + scope; everything else is re-read from the store once per request,
// so deactivation and permission changes apply immediately. X-TanPms-* headers are never consulted.
public sealed class JwtCurrentUserContext : ICurrentUserContext
{
    private static readonly IReadOnlySet<Guid> NoProperties = new HashSet<Guid>();
    private static readonly IReadOnlySet<string> NoPermissions = new HashSet<string>();

    private readonly IHttpContextAccessor _httpContextAccessor;
    private AuthPrincipalRecord? _principal;
    private bool _resolved;

    public JwtCurrentUserContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public AuthPrincipalRecord? Principal
    {
        get
        {
            if (!_resolved)
            {
                _resolved = true;
                _principal = Resolve();
            }

            return _principal;
        }
    }

    public string UserId => Principal?.SubjectId ?? string.Empty;

    public bool IsAdminScope => Principal?.Scope == AuthScopes.Admin;

    public bool IsClientScope => Principal?.Scope == AuthScopes.Client;

    public IReadOnlySet<Guid> AllowedPropertyIds => Principal?.AllowedPropertyIds ?? NoProperties;

    public IReadOnlySet<string> Permissions => Principal?.Permissions ?? NoPermissions;

    public Guid? CustomerId => Principal?.CustomerId;

    public bool HasOpenCashierShift =>
        IsAdminScope && ShiftStore() is { } store && store.HasOpenCashierShift(UserId, AllowedPropertyIds);

    public bool HasOpenCashierShiftIn(Guid propertyId) =>
        IsAdminScope
        && AllowedPropertyIds.Contains(propertyId)
        && ShiftStore() is { } store
        && store.HasOpenCashierShift(UserId, new HashSet<Guid> { propertyId });

    // Stores are resolved lazily: the DbContext audit interceptor depends on this context, so constructor injection would cycle.
    private AuthPrincipalRecord? Resolve()
    {
        var context = _httpContextAccessor.HttpContext;
        var user = context?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        var subject = user.FindFirst(AuthClaimNames.Subject)?.Value;
        var scope = AuthScopes.Parse(user.FindFirst(AuthClaimNames.Scope)?.Value);
        if (string.IsNullOrWhiteSpace(subject) || scope is null
            || context!.RequestServices.GetService(typeof(IAuthStore)) is not IAuthStore store)
        {
            return null;
        }

        var principal = store.ResolvePrincipal(scope, subject);
        return principal is { IsActive: true } ? principal : null;
    }

    private ICashierShiftStore? ShiftStore() =>
        _httpContextAccessor.HttpContext?.RequestServices.GetService(typeof(ICashierShiftStore)) as ICashierShiftStore;
}
