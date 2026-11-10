using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

// Tokens are stateless in this phase, so logout only records the event; the client discards its token.
public sealed class LogoutAuthSessionHandler
{
    public const string ActionKey = "auth.logout";

    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public LogoutAuthSessionHandler(ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<string> Handle(LogoutAuthSessionCommand command)
    {
        if (string.IsNullOrWhiteSpace(_currentUser.UserId) || (!_currentUser.IsAdminScope && !_currentUser.IsClientScope))
        {
            return Result<string>.Failure(new Error(DomainErrorCodes.Unauthenticated, "Caller is not authenticated."));
        }

        var propertyId = _currentUser.IsAdminScope ? _currentUser.AllowedPropertyIds.FirstOrDefault() : Guid.Empty;
        var entityId = _currentUser.CustomerId ?? (Guid.TryParse(_currentUser.UserId, out var userId) ? userId : Guid.Empty);
        _auditLogger.RecordMutation(
            propertyId: propertyId,
            actionKey: ActionKey,
            entityId: entityId,
            reason: $"{(_currentUser.IsAdminScope ? "Admin" : "Client")} user {_currentUser.UserId} logged out",
            afterState: new { _currentUser.UserId, Scope = _currentUser.IsAdminScope ? "admin" : "client" });
        return Result<string>.Success(_currentUser.UserId);
    }
}
