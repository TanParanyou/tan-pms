namespace TanPms.Application.Common.Abstractions;

public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string encodedHash);

    // Burns the same work as a real verification so unknown identifiers cannot be told apart by timing.
    void VerifyDummy(string password);
}
