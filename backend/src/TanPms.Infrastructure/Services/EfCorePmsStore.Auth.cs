using Microsoft.EntityFrameworkCore;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public CredentialRecord? FindCredential(string scope, string identifier)
    {
        if (scope == AuthScopes.Admin)
        {
            var lowered = identifier.Trim().ToLower();
            var user = _dbContext.AdminUsers.AsNoTracking()
                .FirstOrDefault(u => u.Username.ToLower() == lowered || u.Email.ToLower() == lowered);
            return user is null ? null : AuthStoreRules.ToCredential(user);
        }

        var account = _dbContext.CustomerAccounts.AsNoTracking().FirstOrDefault(a => a.LoginIdentifier == identifier);
        return account is null ? null : AuthStoreRules.ToCredential(account);
    }

    public CredentialRecord? FindCredentialBySubject(string scope, string subjectId) =>
        FindHolder(scope, subjectId, tracked: false) switch
        {
            AdminUser user => AuthStoreRules.ToCredential(user),
            CustomerAccount account => AuthStoreRules.ToCredential(account),
            _ => null
        };

    public void RecordLoginFailure(string scope, string subjectId, DateTimeOffset nowUtc, int threshold, TimeSpan lockout)
    {
        if (FindHolder(scope, subjectId, tracked: true) is { } holder)
        {
            holder.RegisterFailedLogin(nowUtc, threshold, lockout);
            _dbContext.SaveChanges();
        }
    }

    public void RecordLoginSuccess(string scope, string subjectId)
    {
        if (FindHolder(scope, subjectId, tracked: true) is { } holder && (holder.FailedLoginCount > 0 || holder.LockedUntil is not null))
        {
            holder.RegisterSuccessfulLogin();
            _dbContext.SaveChanges();
        }
    }

    public Result<AuthSessionResponse> BuildAuthSession(string scope, string subjectId)
    {
        if (scope == AuthScopes.Client)
        {
            var account = FindHolder(scope, subjectId, tracked: false) as CustomerAccount;
            var customer = account is null ? null : _dbContext.Customers.AsNoTracking().FirstOrDefault(c => c.Id == account.CustomerId);
            return customer is null
                ? Result<AuthSessionResponse>.Failure(AuthStoreRules.Unauthenticated())
                : Result<AuthSessionResponse>.Success(AuthStoreRules.ClientSession(customer));
        }

        if (FindHolder(scope, subjectId, tracked: false) is not AdminUser user)
        {
            return Result<AuthSessionResponse>.Failure(AuthStoreRules.Unauthenticated());
        }

        var allowedProperties = _dbContext.Properties.AsNoTracking()
            .Where(p => user.AllowedPropertyIds.Contains(p.Id))
            .OrderBy(p => p.Code)
            .ToList()
            .Select(p => new PropertyRefDto(p.Id, p.Code, LocalizedTextDto.FromDomain(p.Name)))
            .ToList();
        return Result<AuthSessionResponse>.Success(AuthStoreRules.AdminSession(user, allowedProperties));
    }

    public AuthPrincipalRecord? ResolvePrincipal(string scope, string subjectId) =>
        FindHolder(scope, subjectId, tracked: false) switch
        {
            AdminUser user => AuthStoreRules.ToPrincipal(user),
            CustomerAccount account => AuthStoreRules.ToPrincipal(account),
            _ => null
        };

    public Result<bool> SetPassword(string scope, string subjectId, string passwordHash, DateTimeOffset changedAt)
    {
        if (FindHolder(scope, subjectId, tracked: true) is not { } holder)
        {
            return Result<bool>.Failure(AuthStoreRules.Unauthenticated());
        }

        holder.SetPasswordHash(passwordHash, changedAt);
        _dbContext.SaveChanges();
        return Result<bool>.Success(true);
    }

    public Result<CustomerAccountDto> UpsertCustomerAccount(Guid customerId, string normalizedIdentifier, string passwordHash, DateTimeOffset changedAt)
    {
        if (!_dbContext.Customers.AsNoTracking().Any(c => c.Id == customerId))
        {
            return Result<CustomerAccountDto>.Failure(AuthStoreRules.CustomerNotFound(customerId));
        }

        if (_dbContext.CustomerAccounts.AsNoTracking().Any(a => a.LoginIdentifier == normalizedIdentifier && a.CustomerId != customerId))
        {
            return Result<CustomerAccountDto>.Failure(AuthStoreRules.IdentifierTaken());
        }

        var account = _dbContext.CustomerAccounts.FirstOrDefault(a => a.CustomerId == customerId);
        if (account is null)
        {
            account = new CustomerAccount { CustomerId = customerId, LoginIdentifier = normalizedIdentifier };
            _dbContext.CustomerAccounts.Add(account);
        }

        account.LoginIdentifier = normalizedIdentifier;
        account.IsActive = true;
        account.SetPasswordHash(passwordHash, changedAt);
        _dbContext.SaveChanges();
        return Result<CustomerAccountDto>.Success(AuthStoreRules.ToDto(account));
    }

    public void AddRefreshToken(RefreshToken token)
    {
        _dbContext.RefreshTokens.Add(token);
        _dbContext.SaveChanges();
    }

    public RefreshToken? FindRefreshToken(string tokenHash) =>
        _dbContext.RefreshTokens.AsNoTracking().FirstOrDefault(t => t.TokenHash == tokenHash);

    public void RevokeRefreshToken(string tokenHash, DateTimeOffset nowUtc, string? replacedByTokenHash = null)
    {
        if (_dbContext.RefreshTokens.FirstOrDefault(t => t.TokenHash == tokenHash) is { } token)
        {
            token.Revoke(nowUtc, replacedByTokenHash);
            _dbContext.SaveChanges();
        }
    }

    public int RevokeRefreshTokenFamily(Guid familyId, DateTimeOffset nowUtc) =>
        RevokeWhere(_dbContext.RefreshTokens.Where(t => t.FamilyId == familyId && t.RevokedAt == null), nowUtc);

    public int RevokeAllRefreshTokens(string scope, string subjectId, DateTimeOffset nowUtc) =>
        RevokeWhere(_dbContext.RefreshTokens.Where(t => t.Scope == scope && t.SubjectId == subjectId && t.RevokedAt == null), nowUtc);

    private int RevokeWhere(IQueryable<RefreshToken> query, DateTimeOffset nowUtc)
    {
        var tokens = query.ToList();
        foreach (var token in tokens)
        {
            token.Revoke(nowUtc);
        }

        _dbContext.SaveChanges();
        return tokens.Count;
    }

    private CredentialHolder? FindHolder(string scope, string subjectId, bool tracked)
    {
        if (!Guid.TryParse(subjectId, out var id))
        {
            return null;
        }

        if (scope == AuthScopes.Admin)
        {
            var users = tracked ? _dbContext.AdminUsers : _dbContext.AdminUsers.AsNoTracking();
            return users.FirstOrDefault(u => u.Id == id);
        }

        if (scope == AuthScopes.Client)
        {
            var accounts = tracked ? _dbContext.CustomerAccounts : _dbContext.CustomerAccounts.AsNoTracking();
            return accounts.FirstOrDefault(a => a.CustomerId == id);
        }

        return null;
    }
}
