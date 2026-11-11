using TanPms.Application.Identity;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Security;
using Xunit;

namespace TanPms.UnitTests;

public sealed class AuthSecurityUnitTests
{
    private static readonly Pbkdf2PasswordHasher Hasher = new();

    [Fact]
    public void Pbkdf2_Should_Use_A_Versioned_Salted_Format_And_Verify_Only_The_Right_Password()
    {
        var first = Hasher.Hash("correct horse battery");
        var second = Hasher.Hash("correct horse battery");

        Assert.StartsWith("pbkdf2-sha256$v1$600000$", first, StringComparison.Ordinal);
        Assert.NotEqual(first, second);
        Assert.True(Hasher.Verify("correct horse battery", first));
        Assert.False(Hasher.Verify("correct horse batterY", first));
        Assert.False(Hasher.Verify("correct horse battery", first.Replace("v1", "v9", StringComparison.Ordinal)));
        Assert.False(Hasher.Verify("correct horse battery", "garbage"));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Pbkdf2PasswordHasher(1000));
    }

    [Fact]
    public void AuditRedactor_Should_Strip_Secret_Keys_At_Any_Depth_And_Keep_Other_Fields()
    {
        var redacted = AuditRedactor.RedactJson("""{"username":"a","password":"p1","nested":{"refreshToken":"t","items":[{"newPassword":"p2","note":"ok"}]},"passwordHash":"h"}""");

        Assert.NotNull(redacted);
        Assert.DoesNotContain("p1", redacted, StringComparison.Ordinal);
        Assert.DoesNotContain("p2", redacted, StringComparison.Ordinal);
        Assert.DoesNotContain("\"t\"", redacted, StringComparison.Ordinal);
        Assert.DoesNotContain("\"h\"", redacted, StringComparison.Ordinal);
        Assert.Contains("\"username\":\"a\"", redacted, StringComparison.Ordinal);
        Assert.Contains("\"note\":\"ok\"", redacted, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("short", false)]
    [InlineData("          ", false)]
    [InlineData("long-enough-1", true)]
    public void PasswordPolicy_Should_Require_At_Least_Ten_Characters(string? password, bool valid)
    {
        var error = PasswordPolicy.Validate(password);
        Assert.Equal(valid, error is null);
        if (error is not null)
        {
            Assert.Equal(DomainErrorCodes.PasswordPolicyViolation, error.Code);
        }
    }

    [Theory]
    [InlineData(" Somchai@Example.Test ", "somchai@example.test")]
    [InlineData("081-234 5678", "0812345678")]
    [InlineData("Somchai.R", "somchai.r")]
    public void LoginIdentifierNormalizer_Should_Normalize_Emails_And_Phones(string input, string expected) =>
        Assert.Equal(expected, LoginIdentifierNormalizer.Normalize(input));

    [Fact]
    public void CredentialHolder_Should_Lock_After_Threshold_And_Reset_On_Success_Or_New_Password()
    {
        var account = new CustomerAccount { CustomerId = Guid.NewGuid(), LoginIdentifier = "x@example.test" };
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < 4; i++)
        {
            account.RegisterFailedLogin(now, 5, TimeSpan.FromMinutes(15));
        }

        Assert.False(account.IsLockedOut(now));
        account.RegisterFailedLogin(now, 5, TimeSpan.FromMinutes(15));
        Assert.True(account.IsLockedOut(now.AddMinutes(14)));
        Assert.False(account.IsLockedOut(now.AddMinutes(16)));

        account.SetPasswordHash("pbkdf2-sha256$v1$600000$a$b", now);
        Assert.False(account.IsLockedOut(now));
        Assert.Equal(0, account.FailedLoginCount);
    }

    [Fact]
    public void RefreshTokenCodec_Should_Generate_256_Bit_Tokens_Stored_Only_As_Sha256()
    {
        var (raw, hash) = RefreshTokenCodec.Generate();
        Assert.Equal(43, raw.Length);
        Assert.Equal(64, hash.Length);
        Assert.Equal(hash, RefreshTokenCodec.Hash(raw));
        Assert.DoesNotContain(raw, hash, StringComparison.Ordinal);
    }
}
