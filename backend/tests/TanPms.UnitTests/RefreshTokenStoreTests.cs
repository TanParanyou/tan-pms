using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class RefreshTokenStoreTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TryRotate_Should_Succeed_For_Exactly_One_Concurrent_Caller()
    {
        var store = new InMemoryOperationalService();
        store.AddRefreshToken(Token("h-old", Now.AddDays(7)));

        var results = await Task.WhenAll(Enumerable.Range(0, 20).Select(i => Task.Run(() => store.TryRotateRefreshToken("h-old", $"h-new-{i}", Now))));

        Assert.Equal(1, results.Count(r => r));
        Assert.False(store.TryRotateRefreshToken("h-old", "h-other", Now));
        Assert.False(store.TryRotateRefreshToken("missing", "h-other", Now));
    }

    [Fact]
    public void DeleteStale_Should_Remove_Only_Old_Expired_Or_Revoked_Tokens_And_Be_Idempotent()
    {
        var store = new InMemoryOperationalService();
        var retention = TimeSpan.FromDays(30);
        store.AddRefreshToken(Token("active", Now.AddDays(5)));
        store.AddRefreshToken(Token("expired-recent", Now.AddDays(-5)));
        store.AddRefreshToken(Token("expired-old", Now.AddDays(-31)));
        store.AddRefreshToken(Token("revoked-recent", Now.AddDays(5)));
        store.RevokeRefreshToken("revoked-recent", Now.AddDays(-1));
        store.AddRefreshToken(Token("revoked-old", Now.AddDays(5)));
        store.RevokeRefreshToken("revoked-old", Now.AddDays(-31));

        Assert.Equal(2, store.DeleteStaleRefreshTokens(Now, retention));
        Assert.Equal(0, store.DeleteStaleRefreshTokens(Now, retention));
        Assert.All(["active", "expired-recent", "revoked-recent"], h => Assert.NotNull(store.FindRefreshToken(h)));
        Assert.All(["expired-old", "revoked-old"], h => Assert.Null(store.FindRefreshToken(h)));
    }

    private static RefreshToken Token(string hash, DateTimeOffset expiresAt) => new()
    {
        TokenHash = hash,
        FamilyId = Guid.NewGuid(),
        SubjectId = Guid.NewGuid().ToString(),
        Scope = "admin",
        ExpiresAt = expiresAt
    };
}
