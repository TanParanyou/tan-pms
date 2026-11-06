using TanPms.Domain.Common;

namespace TanPms.Domain.Properties;

public sealed class Property : AuditableEntity
{
    public required string Code { get; set; }
    public required LocalizedText Name { get; set; }
    public required string TaxBranchCode { get; set; }
    public LocalizedText? Address { get; set; }
    public List<Building> Buildings { get; init; } = [];
    public List<UnitType> UnitTypes { get; init; } = [];

    public void ValidateTaxBranchCode()
    {
        if (string.IsNullOrWhiteSpace(TaxBranchCode)
            || TaxBranchCode.Length != 5
            || !TaxBranchCode.All(char.IsDigit))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "TaxBranchCode must be a 5-digit string.",
                httpStatus: 400);
        }
    }
}
