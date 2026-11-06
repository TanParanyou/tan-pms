namespace TanPms.Domain.Identity;

public static class RoleCodes
{
    public const string OrganizationAdmin = "OrganizationAdmin";
    public const string PropertyManager = "PropertyManager";
    public const string FrontDeskCashier = "FrontDeskCashier";
    public const string PropertyAccountant = "PropertyAccountant";
    public const string HousekeepingStaff = "HousekeepingStaff";
    public const string MaintenanceTechnician = "MaintenanceTechnician";
    public const string ClientCustomer = "ClientCustomer";

    public static readonly IReadOnlyList<string> All =
    [
        OrganizationAdmin,
        PropertyManager,
        FrontDeskCashier,
        PropertyAccountant,
        HousekeepingStaff,
        MaintenanceTechnician,
        ClientCustomer
    ];
}
