using System.Security.Cryptography;
using System.Text;

namespace TanPms.Application.Identity;

// 256-bit random refresh tokens (base64url) persisted only as their SHA-256 hex digest.
public static class RefreshTokenCodec
{
    public static (string RawToken, string TokenHash) Generate()
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return (raw, Hash(raw));
    }

    public static string Hash(string rawToken) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
