using TanPms.Application.Common.Results;
using TanPms.Domain.Identity;

namespace TanPms.Application.Identity;

public interface IAuthStore
{
    // Admin: username or email; client: normalized CustomerAccount.LoginIdentifier.
    CredentialRecord? FindCredential(string scope, string identifier);

    CredentialRecord? FindCredentialBySubject(string scope, string subjectId);

    void RecordLoginFailure(string scope, string subjectId, DateTimeOffset nowUtc, int threshold, TimeSpan lockout);

    void RecordLoginSuccess(string scope, string subjectId);

    Result<AuthSessionResponse> BuildAuthSession(string scope, string subjectId);

    AuthPrincipalRecord? ResolvePrincipal(string scope, string subjectId);

    Result<bool> SetPassword(string scope, string subjectId, string passwordHash, DateTimeOffset changedAt);

    Result<CustomerAccountDto> UpsertCustomerAccount(Guid customerId, string normalizedIdentifier, string passwordHash, DateTimeOffset changedAt);

    void AddRefreshToken(RefreshToken token);

    RefreshToken? FindRefreshToken(string tokenHash);

    void RevokeRefreshToken(string tokenHash, DateTimeOffset nowUtc, string? replacedByTokenHash = null);

    int RevokeRefreshTokenFamily(Guid familyId, DateTimeOffset nowUtc);

    int RevokeAllRefreshTokens(string scope, string subjectId, DateTimeOffset nowUtc);
}
