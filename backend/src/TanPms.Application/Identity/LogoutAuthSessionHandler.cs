using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

// Revokes the presented refresh token's family (the server session). The short-lived access token simply expires.
public sealed class LogoutAuthSessionHandler
{
    public const string ActionKey = "auth.logout";

    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;
    private readonly IAuthStore _store;
    private readonly TimeProvider _timeProvider;

    public LogoutAuthSessionHandler(ICurrentUserContext currentUser, IAuditLogger auditLogger, IAuthStore store, TimeProvider timeProvider)
    {
        _currentUser = currentUser;
        _auditLogger = auditLogger;
        _store = store;
        _timeProvider = timeProvider;
    }

    public Result<string> Handle(LogoutAuthSessionCommand command)
    {
        if (string.IsNullOrWhiteSpace(_currentUser.UserId) || (!_currentUser.IsAdminScope && !_currentUser.IsClientScope))
        {
            return Result<string>.Failure(new Error(DomainErrorCodes.Unauthenticated, "Caller is not authenticated."));
        }

        var scope = _currentUser.IsAdminScope ? AuthScopes.Admin : AuthScopes.Client;
        var revoked = 0;
        if (!string.IsNullOrWhiteSpace(command.RefreshToken)
            && _store.FindRefreshToken(RefreshTokenCodec.Hash(command.RefreshToken)) is { } token
            && token.Scope == scope
            && string.Equals(token.SubjectId, _currentUser.UserId, StringComparison.OrdinalIgnoreCase))
        {
            revoked = _store.RevokeRefreshTokenFamily(token.FamilyId, _timeProvider.GetUtcNow());
        }

        var propertyId = _currentUser.IsAdminScope ? _currentUser.AllowedPropertyIds.FirstOrDefault() : Guid.Empty;
        var entityId = _currentUser.CustomerId ?? (Guid.TryParse(_currentUser.UserId, out var userId) ? userId : Guid.Empty);
        _auditLogger.RecordMutation(
            propertyId: propertyId,
            actionKey: ActionKey,
            entityId: entityId,
            reason: $"{(_currentUser.IsAdminScope ? "Admin" : "Client")} user {_currentUser.UserId} logged out",
            afterState: new { _currentUser.UserId, Scope = scope, RevokedSessions = revoked });
        return Result<string>.Success(_currentUser.UserId);
    }
}
