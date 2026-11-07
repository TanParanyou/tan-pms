using TanPms.Application.Common.Contracts;
using TanPms.Application.Identity;
using TanPms.Domain.Identity;

namespace TanPms.Infrastructure.Services;

public static class PmsRoleCatalog
{
    public static readonly IReadOnlyList<RoleDefinitionDto> Roles =
    [
        new RoleDefinitionDto(
            RoleCodes.OrganizationAdmin,
            new LocalizedTextDto("ผู้บริหารระดับองค์กร", "Organization Administrator"),
            "AdminScope",
            PermissionKeys.All),
        new RoleDefinitionDto(
            RoleCodes.PropertyManager,
            new LocalizedTextDto("ผู้จัดการสาขา", "Property Manager"),
            "AdminScope",
            [
                PermissionKeys.AdminUsersRead,
                PermissionKeys.AdminPropertiesRead,
                PermissionKeys.AdminReservationsRead,
                PermissionKeys.AdminReservationsManage,
                PermissionKeys.AdminStayCheckIn,
                PermissionKeys.AdminStayCheckOut,
                PermissionKeys.AdminStayOverrideDirtyCheckIn,
                PermissionKeys.AdminCashierReconcileShift,
                PermissionKeys.AdminInvoicesVoid,
                PermissionKeys.AdminLeasesSettleMoveOut,
                PermissionKeys.AdminAnalyticsRead
            ]),
        new RoleDefinitionDto(
            RoleCodes.FrontDeskCashier,
            new LocalizedTextDto("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier"),
            "AdminScope",
            [
                PermissionKeys.AdminReservationsRead,
                PermissionKeys.AdminReservationsManage,
                PermissionKeys.AdminStayCheckIn,
                PermissionKeys.AdminStayCheckOut,
                PermissionKeys.AdminCashierOperateShift,
                PermissionKeys.AdminPaymentsVerifySlip,
                PermissionKeys.AdminParcelsManage
            ]),
        new RoleDefinitionDto(
            RoleCodes.PropertyAccountant,
            new LocalizedTextDto("ฝ่ายบัญชีประจำสาขา", "Property Accountant"),
            "AdminScope",
            [
                PermissionKeys.AdminMetersRecord,
                PermissionKeys.AdminBillingIssueBatch,
                PermissionKeys.AdminPaymentsVerifySlip,
                PermissionKeys.AdminAnalyticsRead
            ]),
        new RoleDefinitionDto(
            RoleCodes.HousekeepingStaff,
            new LocalizedTextDto("ฝ่ายแม่บ้าน", "Housekeeping Staff"),
            "AdminScope",
            [PermissionKeys.AdminHousekeepingUpdate]),
        new RoleDefinitionDto(
            RoleCodes.MaintenanceTechnician,
            new LocalizedTextDto("ช่างซ่อมบำรุง", "Maintenance Technician"),
            "AdminScope",
            [PermissionKeys.AdminWorkOrdersManage]),
        new RoleDefinitionDto(
            RoleCodes.ClientCustomer,
            new LocalizedTextDto("ลูกค้า / ผู้เช่า", "Client / Tenant"),
            "ClientScope",
            [])
    ];

    public static readonly IReadOnlyList<PermissionDefinitionDto> Permissions = PermissionKeys.All
        .Select(key =>
        {
            var isHighRisk = key is PermissionKeys.AdminStayOverrideDirtyCheckIn
                or PermissionKeys.AdminCustomerUnmaskPii
                or PermissionKeys.AdminLeasesSettleMoveOut
                or PermissionKeys.AdminMetersOverrideLocked
                or PermissionKeys.AdminCashierReconcileShift
                or PermissionKeys.AdminInvoicesVoid
                or PermissionKeys.AdminUsersManage;

            return new PermissionDefinitionDto(
                Key: key,
                ModuleCode: key.Split('.')[1].ToUpperInvariant(),
                Description: new LocalizedTextDto($"สิทธิ์ {key}", $"Permission {key}"),
                IsHighRisk: isHighRisk);
        })
        .ToList();
}
