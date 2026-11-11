using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using TanPms.Application.Common.Abstractions;

namespace TanPms.Infrastructure.Security;

// Format: "pbkdf2-sha256$v1$<iterations>$<salt b64>$<hash b64>". The iteration count travels with the hash so it can be raised later.
public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    public const int DefaultIterations = 600_000;
    private const string Prefix = "pbkdf2-sha256";
    private const string Version = "v1";
    private const int SaltBytes = 16;
    private const int HashBytes = 32;

    private readonly int _iterations;
    private readonly Lazy<string> _dummyHash;

    public Pbkdf2PasswordHasher(int iterations = DefaultIterations)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(iterations, DefaultIterations);
        _iterations = iterations;
        _dummyHash = new Lazy<string>(() => Hash(Convert.ToBase64String(RandomNumberGenerator.GetBytes(16))));
    }

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, _iterations, HashAlgorithmName.SHA256, HashBytes);
        return string.Join('$', Prefix, Version, _iterations.ToString(CultureInfo.InvariantCulture), Convert.ToBase64String(salt), Convert.ToBase64String(hash));
    }

    public bool Verify(string password, string encodedHash)
    {
        var parts = encodedHash.Split('$');
        if (parts.Length != 5 || parts[0] != Prefix || parts[1] != Version
            || !int.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var iterations) || iterations < 1)
        {
            return false;
        }

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[3]);
            expected = Convert.FromBase64String(parts[4]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    public void VerifyDummy(string password) => Verify(password, _dummyHash.Value);
}
