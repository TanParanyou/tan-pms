namespace TanPms.Domain.Identity;

// Client-scope login for a customer. LoginIdentifier is stored normalized (see LoginIdentifierNormalizer).
public sealed class CustomerAccount : CredentialHolder
{
    public required Guid CustomerId { get; init; }
    public required string LoginIdentifier { get; set; }
    public bool IsActive { get; set; } = true;
}
