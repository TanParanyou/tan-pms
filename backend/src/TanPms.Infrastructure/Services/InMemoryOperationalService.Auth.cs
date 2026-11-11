using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Domain.Identity;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    private readonly List<CustomerAccount> _customerAccounts = [];
    private readonly List<RefreshToken> _refreshTokens = [];

    // Dev/Testing only: gives every seeded admin and both seeded customers the same dev password.
    // Called explicitly by the host (never from the constructor) so Production never gets default-password accounts.
    // Seeded identifiers are listed in PmsSeedConstants.DevLogin*.
    public void SeedDevCredentials(IPasswordHasher passwordHasher, string devPassword)
    {
        // One hash shared by all seeded dev accounts keeps start-up fast (600k PBKDF2 iterations each).
        var hash = passwordHasher.Hash(devPassword);
        var now = DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            foreach (var user in _adminUsers.Where(u => u.PasswordHash is null))
            {
                user.SetPasswordHash(hash, now);
            }

            foreach (var (customerId, identifier) in PmsSeedConstants.DevCustomerLogins)
            {
                if (_customers.ContainsKey(customerId) && _customerAccounts.All(a => a.CustomerId != customerId))
                {
                    var account = new CustomerAccount { CustomerId = customerId, LoginIdentifier = identifier };
                    account.SetPasswordHash(hash, now);
                    _customerAccounts.Add(account);
                }
            }
        }
    }

    public CredentialRecord? FindCredential(string scope, string identifier)
    {
        lock (_syncRoot)
        {
            if (scope == AuthScopes.Admin)
            {
                var user = _adminUsers.FirstOrDefault(u =>
                    string.Equals(u.Username, identifier.Trim(), StringComparison.OrdinalIgnoreCase)
                    || string.Equals(u.Email, identifier.Trim(), StringComparison.OrdinalIgnoreCase));
                return user is null ? null : AuthStoreRules.ToCredential(user);
            }

            var account = _customerAccounts.FirstOrDefault(a => a.LoginIdentifier == identifier);
            return account is null ? null : AuthStoreRules.ToCredential(account);
        }
    }

    public CredentialRecord? FindCredentialBySubject(string scope, string subjectId)
    {
        lock (_syncRoot)
        {
            return FindHolder(scope, subjectId) switch
            {
                AdminUser user => AuthStoreRules.ToCredential(user),
                CustomerAccount account => AuthStoreRules.ToCredential(account),
                _ => null
            };
        }
    }

    public void RecordLoginFailure(string scope, string subjectId, DateTimeOffset nowUtc, int threshold, TimeSpan lockout)
    {
        lock (_syncRoot)
        {
            FindHolder(scope, subjectId)?.RegisterFailedLogin(nowUtc, threshold, lockout);
        }
    }

    public void RecordLoginSuccess(string scope, string subjectId)
    {
        lock (_syncRoot)
        {
            FindHolder(scope, subjectId)?.RegisterSuccessfulLogin();
        }
    }

    public Result<AuthSessionResponse> BuildAuthSession(string scope, string subjectId)
    {
        lock (_syncRoot)
        {
            switch (FindHolder(scope, subjectId))
            {
                case CustomerAccount account when _customers.TryGetValue(account.CustomerId, out var customer):
                    return Result<AuthSessionResponse>.Success(AuthStoreRules.ClientSession(customer));
                case AdminUser user:
                    var allowed = user.AllowedPropertyIds
                        .Where(_properties.ContainsKey)
                        .Select(id => _properties[id])
                        .OrderBy(p => p.Code, StringComparer.Ordinal)
                        .Select(p => new PropertyRefDto(p.Id, p.Code, LocalizedTextDto.FromDomain(p.Name)))
                        .ToList();
                    return Result<AuthSessionResponse>.Success(AuthStoreRules.AdminSession(user, allowed));
                default:
                    return Result<AuthSessionResponse>.Failure(AuthStoreRules.Unauthenticated());
            }
        }
    }

    public AuthPrincipalRecord? ResolvePrincipal(string scope, string subjectId)
    {
        lock (_syncRoot)
        {
            return FindHolder(scope, subjectId) switch
            {
                AdminUser user => AuthStoreRules.ToPrincipal(user),
                CustomerAccount account => AuthStoreRules.ToPrincipal(account),
                _ => null
            };
        }
    }

    public Result<bool> SetPassword(string scope, string subjectId, string passwordHash, DateTimeOffset changedAt)
    {
        lock (_syncRoot)
        {
            if (FindHolder(scope, subjectId) is not { } holder)
            {
                return Result<bool>.Failure(AuthStoreRules.Unauthenticated());
            }

            holder.SetPasswordHash(passwordHash, changedAt);
            Touch(holder);
            return Result<bool>.Success(true);
        }
    }

    public Result<CustomerAccountDto> UpsertCustomerAccount(Guid customerId, string normalizedIdentifier, string passwordHash, DateTimeOffset changedAt)
    {
        lock (_syncRoot)
        {
            if (!_customers.ContainsKey(customerId))
            {
                return Result<CustomerAccountDto>.Failure(AuthStoreRules.CustomerNotFound(customerId));
            }

            if (_customerAccounts.Any(a => a.LoginIdentifier == normalizedIdentifier && a.CustomerId != customerId))
            {
                return Result<CustomerAccountDto>.Failure(AuthStoreRules.IdentifierTaken());
            }

            var account = _customerAccounts.FirstOrDefault(a => a.CustomerId == customerId);
            if (account is null)
            {
                account = new CustomerAccount { CustomerId = customerId, LoginIdentifier = normalizedIdentifier };
                _customerAccounts.Add(account);
            }

            account.LoginIdentifier = normalizedIdentifier;
            account.IsActive = true;
            account.SetPasswordHash(passwordHash, changedAt);
            Touch(account);
            return Result<CustomerAccountDto>.Success(AuthStoreRules.ToDto(account));
        }
    }

    public void AddRefreshToken(RefreshToken token)
    {
        lock (_syncRoot)
        {
            _refreshTokens.Add(token);
        }
    }

    public RefreshToken? FindRefreshToken(string tokenHash)
    {
        lock (_syncRoot)
        {
            return _refreshTokens.FirstOrDefault(t => t.TokenHash == tokenHash);
        }
    }

    public void RevokeRefreshToken(string tokenHash, DateTimeOffset nowUtc, string? replacedByTokenHash = null)
    {
        lock (_syncRoot)
        {
            _refreshTokens.FirstOrDefault(t => t.TokenHash == tokenHash)?.Revoke(nowUtc, replacedByTokenHash);
        }
    }

    public int RevokeRefreshTokenFamily(Guid familyId, DateTimeOffset nowUtc) =>
        RevokeWhere(t => t.FamilyId == familyId, nowUtc);

    public int RevokeAllRefreshTokens(string scope, string subjectId, DateTimeOffset nowUtc) =>
        RevokeWhere(t => t.Scope == scope && string.Equals(t.SubjectId, subjectId, StringComparison.OrdinalIgnoreCase), nowUtc);

    private int RevokeWhere(Func<RefreshToken, bool> predicate, DateTimeOffset nowUtc)
    {
        lock (_syncRoot)
        {
            var tokens = _refreshTokens.Where(t => t.RevokedAt is null && predicate(t)).ToList();
            foreach (var token in tokens)
            {
                token.Revoke(nowUtc);
            }

            return tokens.Count;
        }
    }

    private CredentialHolder? FindHolder(string scope, string subjectId)
    {
        if (!Guid.TryParse(subjectId, out var id))
        {
            return null;
        }

        return scope switch
        {
            AuthScopes.Admin => _adminUsers.FirstOrDefault(u => u.Id == id),
            AuthScopes.Client => _customerAccounts.FirstOrDefault(a => a.CustomerId == id),
            _ => null
        };
    }
}
