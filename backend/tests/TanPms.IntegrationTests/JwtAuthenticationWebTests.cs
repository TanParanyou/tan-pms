using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Identity;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.ErrorHandling;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class JwtAuthenticationWebTests : IClassFixture<JwtWebApiFactory>
{
    private const string DevPassword = InMemoryWebApiFactory.DevPassword;
    private readonly JwtWebApiFactory _factory;

    public JwtAuthenticationWebTests(JwtWebApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_Should_Issue_Tokens_And_Fail_Generically_For_Wrong_Password_Or_Unknown_User()
    {
        using var client = _factory.CreateClient();
        var session = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        Assert.Equal(AuthSessionIssuer.BearerTokenType, session.TokenType);
        Assert.False(string.IsNullOrEmpty(session.AccessToken));
        Assert.False(string.IsNullOrEmpty(session.RefreshToken));
        Assert.True(session.AccessTokenExpiresAt > DateTimeOffset.UtcNow);
        Assert.True(session.RefreshTokenExpiresAt > session.AccessTokenExpiresAt);

        var me = await SendAsync(client, HttpMethod.Get, "/api/v1/auth/me", session.AccessToken);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal("Naphat Wattanakul", (await me.Content.ReadFromJsonAsync<AuthSessionResponse>())!.DisplayName);

        var wrongPassword = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "naphat.admin", "not-the-password"));
        var unknownUser = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "nobody.here", "not-the-password"));
        var wrongProblem = await AssertProblemAsync(wrongPassword, HttpStatusCode.Unauthorized, DomainErrorCodes.InvalidCredentials);
        var unknownProblem = await AssertProblemAsync(unknownUser, HttpStatusCode.Unauthorized, DomainErrorCodes.InvalidCredentials);
        Assert.Equal(wrongProblem.Detail, unknownProblem.Detail);
        Assert.Equal(wrongProblem.Title, unknownProblem.Title);
    }

    [Fact]
    public async Task Lockout_Should_Block_Correct_Password_After_Five_Failures_Until_The_Window_Passes()
    {
        await using var factory = new JwtWebApiFactory();
        using var client = factory.CreateClient();
        for (var i = 0; i < 5; i++)
        {
            var failed = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "pimchanok.bkk", "wrong-password-x"));
            Assert.Equal(HttpStatusCode.Unauthorized, failed.StatusCode);
        }

        var locked = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "pimchanok.bkk", DevPassword));
        await AssertProblemAsync(locked, HttpStatusCode.Unauthorized, DomainErrorCodes.InvalidCredentials);

        factory.Clock.Now = factory.Clock.Now.AddMinutes(16);
        var unlocked = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "pimchanok.bkk", DevPassword));
        Assert.Equal(HttpStatusCode.OK, unlocked.StatusCode);
    }

    [Fact]
    public async Task Login_Should_Be_Rate_Limited_Per_Client_When_Enabled()
    {
        await using var factory = new JwtWebApiFactory().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Auth:RateLimit:Enabled", "true");
            builder.UseSetting("Auth:RateLimit:PermitLimit", "2");
            builder.UseSetting("Auth:RateLimit:WindowSeconds", "60");
        });
        using var client = factory.CreateClient();
        for (var i = 0; i < 2; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "nobody", "wrong-password-x"))).StatusCode);
        }

        var limited = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "nobody", "wrong-password-x"));
        await AssertProblemAsync(limited, HttpStatusCode.TooManyRequests, DomainErrorCodes.RateLimited);
    }

    [Fact]
    public async Task Forged_TanPms_Headers_Should_Be_Ignored_In_Jwt_Mode()
    {
        using var client = _factory.CreateClient();
        using var forged = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/users");
        forged.Headers.Add("X-TanPms-Scope", "admin");
        forged.Headers.Add("X-TanPms-User-Id", Guid.NewGuid().ToString());
        forged.Headers.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        forged.Headers.Add("X-TanPms-Permissions", PermissionKeys.AdminUsersRead);
        var anonymous = await client.SendAsync(forged);
        await AssertProblemAsync(anonymous, HttpStatusCode.Unauthorized, DomainErrorCodes.Unauthenticated);
        Assert.Contains("Bearer", anonymous.Headers.WwwAuthenticate.ToString(), StringComparison.Ordinal);

        // A low-privilege token plus forged permission headers still gets only its real permissions.
        var cashier = await LoginAsync(client, "admin", "pimchanok.bkk", DevPassword);
        using var escalate = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/users");
        escalate.Headers.Authorization = new AuthenticationHeaderValue("Bearer", cashier.AccessToken);
        escalate.Headers.Add("X-TanPms-Permissions", PermissionKeys.AdminUsersRead);
        escalate.Headers.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.CnxPropertyId.ToString());
        await AssertProblemAsync(await client.SendAsync(escalate), HttpStatusCode.Forbidden, DomainErrorCodes.PermissionDenied);
    }

    [Fact]
    public async Task Expired_Tampered_And_Foreign_Issuer_Or_Audience_Tokens_Should_Be_Rejected()
    {
        using var client = _factory.CreateClient();
        var subject = (await LoginAsync(client, "admin", "naphat.admin", DevPassword)).UserId;
        var now = DateTimeOffset.UtcNow;

        var valid = MintToken(subject, "admin", JwtWebApiFactory.Issuer, JwtWebApiFactory.Audience, InMemoryWebApiFactory.TestSigningKey, now.AddMinutes(-1), now.AddMinutes(5));
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Get, "/api/v1/auth/me", valid)).StatusCode);

        var expired = MintToken(subject, "admin", JwtWebApiFactory.Issuer, JwtWebApiFactory.Audience, InMemoryWebApiFactory.TestSigningKey, now.AddMinutes(-30), now.AddMinutes(-5));
        var wrongKey = MintToken(subject, "admin", JwtWebApiFactory.Issuer, JwtWebApiFactory.Audience, "another-signing-key-that-is-long-enough-0123", now.AddMinutes(-1), now.AddMinutes(5));
        var wrongIssuer = MintToken(subject, "admin", "someone-else", JwtWebApiFactory.Audience, InMemoryWebApiFactory.TestSigningKey, now.AddMinutes(-1), now.AddMinutes(5));
        var wrongAudience = MintToken(subject, "admin", JwtWebApiFactory.Issuer, "other-app", InMemoryWebApiFactory.TestSigningKey, now.AddMinutes(-1), now.AddMinutes(5));
        var parts = valid.Split('.');
        var tamperedPayload = Base64UrlEncoder.Encode(Base64UrlEncoder.Decode(parts[1]).Replace("\"admin\"", "\"client\"", StringComparison.Ordinal));
        var tampered = $"{parts[0]}.{tamperedPayload}.{parts[2]}";

        foreach (var token in new[] { expired, wrongKey, wrongIssuer, wrongAudience, tampered, "not-a-jwt" })
        {
            var response = await SendAsync(client, HttpMethod.Get, "/api/v1/auth/me", token);
            await AssertProblemAsync(response, HttpStatusCode.Unauthorized, DomainErrorCodes.Unauthenticated);
            Assert.Contains("Bearer", response.Headers.WwwAuthenticate.ToString(), StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Client_And_Admin_Tokens_Should_Not_Cross_Route_Families()
    {
        using var client = _factory.CreateClient();
        var admin = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        var customer = await LoginAsync(client, "client", "Somchai@Example.Test", DevPassword);
        Assert.Equal(PmsSeedConstants.PrimaryCustomerId, customer.Customer!.Id);

        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Get, "/api/v1/client/parcels", customer.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Get, "/api/v1/admin/users", admin.AccessToken)).StatusCode);
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Get, "/api/v1/admin/users", customer.AccessToken), HttpStatusCode.Forbidden, DomainErrorCodes.PermissionDenied);
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Get, "/api/v1/client/parcels", admin.AccessToken), HttpStatusCode.Forbidden, DomainErrorCodes.PermissionDenied);
    }

    [Fact]
    public async Task Deactivation_And_Permission_Changes_Should_Apply_To_Existing_Tokens_Immediately()
    {
        using var client = _factory.CreateClient();
        var admin = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        var request = NewUserRequest("hk.live", RoleCodes.HousekeepingStaff, "hk-live-password");
        var created = await PostAsync<AdminUserDto>(client, "/api/v1/admin/users", request, admin.AccessToken);

        var staff = await LoginAsync(client, "admin", "hk.live", "hk-live-password");
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Get, "/api/v1/admin/users", staff.AccessToken), HttpStatusCode.Forbidden, DomainErrorCodes.PermissionDenied);

        await PostAsync<AdminUserDto>(client, "/api/v1/admin/users", request with { Id = created.Id, RoleCode = RoleCodes.PropertyManager, InitialPassword = null }, admin.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Get, "/api/v1/admin/users", staff.AccessToken)).StatusCode);

        await PostAsync<AdminUserDto>(client, $"/api/v1/admin/users/{created.Id}/deactivate", new ReasonRequest("Left the company"), admin.AccessToken);
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Get, "/api/v1/auth/me", staff.AccessToken), HttpStatusCode.Unauthorized, DomainErrorCodes.Unauthenticated);
        await AssertProblemAsync(
            await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(staff.RefreshToken!)),
            HttpStatusCode.Unauthorized,
            DomainErrorCodes.RefreshTokenInvalid);
        await AssertProblemAsync(
            await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "hk.live", "hk-live-password")),
            HttpStatusCode.Unauthorized,
            DomainErrorCodes.InvalidCredentials);
    }

    [Fact]
    public async Task Refresh_Should_Rotate_And_Reuse_Of_A_Rotated_Token_Should_Revoke_The_Family()
    {
        using var client = _factory.CreateClient();
        var first = await LoginAsync(client, "admin", "naphat.admin", DevPassword);

        var rotatedRes = await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(first.RefreshToken!));
        Assert.Equal(HttpStatusCode.OK, rotatedRes.StatusCode);
        var rotated = (await rotatedRes.Content.ReadFromJsonAsync<AuthSessionResponse>())!;
        Assert.NotEqual(first.RefreshToken, rotated.RefreshToken);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Get, "/api/v1/auth/me", rotated.AccessToken)).StatusCode);

        await AssertProblemAsync(
            await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(first.RefreshToken!)),
            HttpStatusCode.Unauthorized,
            DomainErrorCodes.RefreshTokenInvalid);
        await AssertProblemAsync(
            await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(rotated.RefreshToken!)),
            HttpStatusCode.Unauthorized,
            DomainErrorCodes.RefreshTokenInvalid);
    }

    [Fact]
    public async Task Logout_Should_Revoke_The_Presented_Refresh_Token()
    {
        using var client = _factory.CreateClient();
        var session = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout")
        {
            Content = JsonContent.Create(new LogoutRequest(session.RefreshToken))
        };
        logout.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(logout)).StatusCode);

        await AssertProblemAsync(
            await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(session.RefreshToken!)),
            HttpStatusCode.Unauthorized,
            DomainErrorCodes.RefreshTokenInvalid);
    }

    [Fact]
    public async Task Change_Password_Should_Revoke_Every_Session_And_Swap_The_Credential()
    {
        using var client = _factory.CreateClient();
        var admin = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        await PostAsync<AdminUserDto>(client, "/api/v1/admin/users", NewUserRequest("pw.change", RoleCodes.FrontDeskCashier, "first-password-1"), admin.AccessToken);

        var sessionA = await LoginAsync(client, "admin", "pw.change", "first-password-1");
        var sessionB = await LoginAsync(client, "admin", "pw.change", "first-password-1");

        var wrongCurrent = await SendAsync(client, HttpMethod.Post, "/api/v1/auth/change-password", sessionA.AccessToken, new ChangePasswordRequest("nope-nope-nope", "second-password-2"));
        await AssertProblemAsync(wrongCurrent, HttpStatusCode.Unauthorized, DomainErrorCodes.InvalidCredentials);
        var tooShort = await SendAsync(client, HttpMethod.Post, "/api/v1/auth/change-password", sessionA.AccessToken, new ChangePasswordRequest("first-password-1", "short"));
        await AssertProblemAsync(tooShort, HttpStatusCode.BadRequest, DomainErrorCodes.PasswordPolicyViolation);

        var changed = await SendAsync(client, HttpMethod.Post, "/api/v1/auth/change-password", sessionA.AccessToken, new ChangePasswordRequest("first-password-1", "second-password-2"));
        Assert.Equal(HttpStatusCode.NoContent, changed.StatusCode);

        foreach (var refresh in new[] { sessionA.RefreshToken!, sessionB.RefreshToken! })
        {
            await AssertProblemAsync(await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(refresh)), HttpStatusCode.Unauthorized, DomainErrorCodes.RefreshTokenInvalid);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "pw.change", "first-password-1"))).StatusCode);
        await LoginAsync(client, "admin", "pw.change", "second-password-2");
        Assert.Contains(AuditEvents(), e => e.ActionKey == ChangePasswordHandler.ActionKey);
    }

    [Fact]
    public async Task Admin_Reset_Password_Should_Enforce_Permission_Scope_And_Not_Self()
    {
        using var client = _factory.CreateClient();
        var orgAdmin = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        var cashier = await LoginAsync(client, "admin", "pimchanok.bkk", DevPassword);
        var target = await PostAsync<AdminUserDto>(client, "/api/v1/admin/users", NewUserRequest("cnx.reset", RoleCodes.FrontDeskCashier, "cnx-initial-pass", PmsSeedConstants.CnxPropertyId), orgAdmin.AccessToken);
        var targetSession = await LoginAsync(client, "admin", "cnx.reset", "cnx-initial-pass");
        var reset = new ResetPasswordRequest("cnx-reset-password");

        await AssertProblemAsync(await SendAsync(client, HttpMethod.Post, $"/api/v1/admin/users/{target.Id}/reset-password", cashier.AccessToken, reset), HttpStatusCode.Forbidden, DomainErrorCodes.PermissionDenied);

        await PostAsync<AdminUserDto>(client, "/api/v1/admin/users", NewUserRequest("bkk.orgadmin", RoleCodes.OrganizationAdmin, "bkk-orgadmin-pass"), orgAdmin.AccessToken);
        var bkkOnlyAdmin = await LoginAsync(client, "admin", "bkk.orgadmin", "bkk-orgadmin-pass");
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Post, $"/api/v1/admin/users/{target.Id}/reset-password", bkkOnlyAdmin.AccessToken, reset), HttpStatusCode.Forbidden, DomainErrorCodes.PropertyScopeDenied);

        await AssertProblemAsync(await SendAsync(client, HttpMethod.Post, $"/api/v1/admin/users/{orgAdmin.UserId}/reset-password", orgAdmin.AccessToken, reset), HttpStatusCode.BadRequest, DomainErrorCodes.ValidationFailed);
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Post, $"/api/v1/admin/users/{target.Id}/reset-password", orgAdmin.AccessToken, new ResetPasswordRequest("short")), HttpStatusCode.BadRequest, DomainErrorCodes.PasswordPolicyViolation);

        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Post, $"/api/v1/admin/users/{target.Id}/reset-password", orgAdmin.AccessToken, reset)).StatusCode);
        await AssertProblemAsync(await client.PostAsJsonAsync("/api/v1/auth/refresh", new RefreshSessionRequest(targetSession.RefreshToken!)), HttpStatusCode.Unauthorized, DomainErrorCodes.RefreshTokenInvalid);
        await LoginAsync(client, "admin", "cnx.reset", "cnx-reset-password");
        Assert.Contains(AuditEvents(), e => e.ActionKey == ResetAdminUserPasswordHandler.ActionKey && e.EntityId == target.Id);
    }

    [Fact]
    public async Task Customer_Account_Should_Be_Created_By_Admin_And_Usable_For_Client_Login()
    {
        using var client = _factory.CreateClient();
        var admin = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        var foreignCustomerId = Guid.Parse("44444444-4444-4444-4444-444444444403");

        var account = await PostAsync<CustomerAccountDto>(client, $"/api/v1/admin/customers/{foreignCustomerId}/account", new CustomerAccountRequest(" John.Miller@Example.Test ", "john-miller-pass"), admin.AccessToken);
        Assert.Equal("john.miller@example.test", account.LoginIdentifier);
        Assert.DoesNotContain("john-miller-pass", System.Text.Json.JsonSerializer.Serialize(account), StringComparison.Ordinal);

        var duplicate = await SendAsync(client, HttpMethod.Post, $"/api/v1/admin/customers/{PmsSeedConstants.SecondaryCustomerId}/account", admin.AccessToken, new CustomerAccountRequest("john.miller@example.test", "another-pass-12"));
        await AssertProblemAsync(duplicate, HttpStatusCode.Conflict, DomainErrorCodes.MasterDataInUse);

        var housekeeping = await PostAsync<AdminUserDto>(client, "/api/v1/admin/users", NewUserRequest("hk.account", RoleCodes.HousekeepingStaff, "hk-account-pass"), admin.AccessToken);
        var hkSession = await LoginAsync(client, "admin", housekeeping.Username, "hk-account-pass");
        await AssertProblemAsync(
            await SendAsync(client, HttpMethod.Post, $"/api/v1/admin/customers/{foreignCustomerId}/account", hkSession.AccessToken, new CustomerAccountRequest("x@example.test", "another-pass-12")),
            HttpStatusCode.Forbidden,
            DomainErrorCodes.PermissionDenied);

        var customer = await LoginAsync(client, "client", "JOHN.MILLER@example.test", "john-miller-pass");
        Assert.Equal(foreignCustomerId, customer.Customer!.Id);
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Get, "/api/v1/client/parcels", customer.AccessToken)).StatusCode);
    }

    [Fact]
    public async Task Passwords_Hashes_And_Tokens_Should_Never_Reach_Audit_Or_Logs()
    {
        using var client = _factory.CreateClient();
        var admin = await LoginAsync(client, "admin", "naphat.admin", DevPassword);
        await PostAsync<AdminUserDto>(client, "/api/v1/admin/users", NewUserRequest("secret.check", RoleCodes.FrontDeskCashier, "secret-check-pass-1"), admin.AccessToken);
        var user = await LoginAsync(client, "admin", "secret.check", "secret-check-pass-1");
        await SendAsync(client, HttpMethod.Post, "/api/v1/auth/change-password", user.AccessToken, new ChangePasswordRequest("secret-check-pass-1", "secret-check-pass-2"));
        await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("admin", "secret.check", "secret-wrong-pass-3"));

        string[] secrets = [DevPassword, "secret-check-pass-1", "secret-check-pass-2", "secret-wrong-pass-3", admin.AccessToken, admin.RefreshToken!, user.RefreshToken!, "pbkdf2-sha256"];
        var auditText = string.Join('\n', AuditEvents().Select(e => $"{e.Reason} {e.BeforeStateJson} {e.AfterStateJson}"));
        var logText = string.Join('\n', _factory.Logs.Lines);
        foreach (var secret in secrets)
        {
            Assert.DoesNotContain(secret, auditText, StringComparison.Ordinal);
            Assert.DoesNotContain(secret, logText, StringComparison.Ordinal);
        }
    }

    private IReadOnlyCollection<AuditEvent> AuditEvents() =>
        _factory.Services.GetRequiredService<InMemoryOperationalService>().AuditEvents;

    private static UpsertAdminUserRequest NewUserRequest(string username, string roleCode, string password, Guid? propertyId = null) =>
        new(null, username, $"{username} test", $"{username}@tan-pms.test", roleCode, [propertyId ?? PmsSeedConstants.BkkPropertyId], true, password);

    private static async Task<AuthSessionResponse> LoginAsync(HttpClient client, string scope, string identifier, string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(scope, identifier, password));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<AuthSessionResponse>())!;
    }

    private static async Task<T> PostAsync<T>(HttpClient client, string path, object body, string accessToken)
    {
        var response = await SendAsync(client, HttpMethod.Post, path, accessToken, body);
        Assert.True(response.IsSuccessStatusCode, $"{path} -> {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    private static async Task<HttpResponseMessage> SendAsync(HttpClient client, HttpMethod method, string path, string accessToken, object? body = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, body.GetType());
        }

        return await client.SendAsync(request);
    }

    private static async Task<ApiProblemDetails> AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(code, problem.ErrorCode);
        return problem;
    }

    private static string MintToken(string subject, string scope, string issuer, string audience, string key, DateTimeOffset issuedAt, DateTimeOffset expires) =>
        new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            IssuedAt = issuedAt.UtcDateTime,
            NotBefore = issuedAt.UtcDateTime,
            Expires = expires.UtcDateTime,
            Subject = new ClaimsIdentity([new Claim("sub", subject), new Claim("scope", scope), new Claim("jti", Guid.NewGuid().ToString("N"))]),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256)
        });
}
