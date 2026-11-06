using TanPms.Domain.Common;

namespace TanPms.Domain.Customers;

public sealed class Customer : AuditableEntity
{
    public required string FullName { get; set; }
    public required string NationalIdOrPassport { get; set; }
    public bool IsPassport { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool IsCorporate { get; set; }
    public string? TaxId { get; set; }

    public string GetMaskedIdentity() => PiiMasker.MaskIdentity(NationalIdOrPassport, IsPassport);
}
