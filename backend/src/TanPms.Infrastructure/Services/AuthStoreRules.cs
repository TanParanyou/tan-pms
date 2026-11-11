using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Identity;

namespace TanPms.Infrastructure.Services;

// Shared projections for the EF and in-memory IAuthStore implementations.
internal static class AuthStoreRules
{
    private static readonly IReadOnlySet<Guid> NoProperties = new HashSet<Guid>();
    private static readonly IReadOnlySet<string> NoPermissions = new HashSet<string>();

    public static Error Unauthenticated() => new(DomainErrorCodes.Unauthenticated, "Caller is not authenticated.");

    public static Error CustomerNotFound(Guid customerId) =>
        new(DomainErrorCodes.ValidationFailed, $"Customer '{customerId}' was not found.");

    public static Error IdentifierTaken() =>
        new(DomainErrorCodes.MasterDataInUse, "This login identifier is already used by another customer.");

    public static CredentialRecord ToCredential(AdminUser user) =>
        new(user.Id.ToString(), AuthScopes.Admin, user.PasswordHash, user.IsActive, user.LockedUntil);

    public static CredentialRecord ToCredential(CustomerAccount account) =>
        new(account.CustomerId.ToString(), AuthScopes.Client, account.PasswordHash, account.IsActive, account.LockedUntil);

    public static AuthPrincipalRecord ToPrincipal(AdminUser user) =>
        new(user.Id.ToString(), AuthScopes.Admin, user.IsActive, user.AllowedPropertyIds.ToHashSet(), user.Permissions.ToHashSet(StringComparer.Ordinal), null);

    public static AuthPrincipalRecord ToPrincipal(CustomerAccount account) =>
        new(account.CustomerId.ToString(), AuthScopes.Client, account.IsActive, NoProperties, NoPermissions, account.CustomerId);

    public static CustomerAccountDto ToDto(CustomerAccount account) =>
        new(account.CustomerId, account.LoginIdentifier, account.IsActive, account.PasswordChangedAt);

    // AccessToken is filled by AuthSessionIssuer at login/refresh; /auth/me returns it empty.
    public static AuthSessionResponse ClientSession(Customer customer) =>
        new(
            UserId: customer.Id.ToString(),
            Scope: AuthScopes.Client,
            DisplayName: customer.FullName,
            RoleCode: RoleCodes.ClientCustomer,
            RoleName: new LocalizedTextDto("ลูกค้า / ผู้เช่า", "Client / Tenant"),
            AllowedProperties: [],
            Permissions: [],
            Customer: new CustomerRefDto(customer.Id, customer.FullName, customer.GetMaskedIdentity()),
            AccessToken: string.Empty);

    public static AuthSessionResponse AdminSession(AdminUser user, IReadOnlyList<PropertyRefDto> allowedProperties) =>
        new(
            UserId: user.Id.ToString(),
            Scope: AuthScopes.Admin,
            DisplayName: user.FullName,
            RoleCode: user.RoleCode,
            RoleName: LocalizedTextDto.FromDomain(user.RoleName),
            AllowedProperties: allowedProperties,
            Permissions: user.Permissions.ToList(),
            Customer: null,
            AccessToken: string.Empty);
}
