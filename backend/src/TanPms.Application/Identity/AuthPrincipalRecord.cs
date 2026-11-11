namespace TanPms.Application.Identity;

// What the API trusts about a caller: resolved from the store on every request, never from token claims.
public sealed record AuthPrincipalRecord(
    string SubjectId,
    string Scope,
    bool IsActive,
    IReadOnlySet<Guid> AllowedPropertyIds,
    IReadOnlySet<string> Permissions,
    Guid? CustomerId);
