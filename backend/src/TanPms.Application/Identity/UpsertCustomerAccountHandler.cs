using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

// Creates or re-keys a customer's client login. Setting a new password revokes the customer's existing sessions.
public sealed class UpsertCustomerAccountHandler
{
    public const string ActionKey = "admin.customers.account";

    private readonly IAuthStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuditLogger _auditLogger;
    private readonly TimeProvider _timeProvider;

    public UpsertCustomerAccountHandler(IAuthStore store, ICurrentUserContext currentUser, IPasswordHasher passwordHasher, IAuditLogger auditLogger, TimeProvider timeProvider)
    {
        _store = store;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
        _auditLogger = auditLogger;
        _timeProvider = timeProvider;
    }

    public Result<CustomerAccountDto> Handle(UpsertCustomerAccountCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminAnyPermission(_currentUser, PermissionKeys.AdminLeasesManage, PermissionKeys.AdminStayCheckIn) is { } authError)
        {
            return Result<CustomerAccountDto>.Failure(authError);
        }

        var identifier = LoginIdentifierNormalizer.Normalize(command.Request.LoginIdentifier);
        if (identifier.Length is < 3 or > 128)
        {
            return Result<CustomerAccountDto>.Failure(new Error(DomainErrorCodes.ValidationFailed, "LoginIdentifier must be 3-128 characters."));
        }

        if (PasswordPolicy.Validate(command.Request.InitialPassword) is { } policyError)
        {
            return Result<CustomerAccountDto>.Failure(policyError);
        }

        var now = _timeProvider.GetUtcNow();
        var result = _store.UpsertCustomerAccount(command.CustomerId, identifier, _passwordHasher.Hash(command.Request.InitialPassword), now);
        if (result.IsFailure || result.Value is null)
        {
            return result;
        }

        var revoked = _store.RevokeAllRefreshTokens(AuthScopes.Client, command.CustomerId.ToString(), now);
        _auditLogger.RecordMutation(
            propertyId: _currentUser.AllowedPropertyIds.FirstOrDefault(),
            actionKey: ActionKey,
            entityId: command.CustomerId,
            reason: $"Client login set for customer {command.CustomerId}",
            afterState: new { result.Value.LoginIdentifier, result.Value.IsActive, RevokedSessions = revoked });
        return result;
    }
}
