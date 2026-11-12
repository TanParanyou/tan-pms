using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Domain.Notifications;
using Xunit;

namespace TanPms.UnitTests;

public sealed class IdentityAndNotificationDomainTests
{
    [Fact]
    public void PermissionKeys_And_RoleCodes_Should_Contain_All_Canonical_Definitions()
    {
        Assert.Equal(7, RoleCodes.All.Count);
        Assert.Contains(RoleCodes.OrganizationAdmin, RoleCodes.All);
        Assert.Contains(RoleCodes.ClientCustomer, RoleCodes.All);

        Assert.Equal(26, PermissionKeys.All.Count);
        Assert.Contains(PermissionKeys.AdminUsersRead, PermissionKeys.All);
        Assert.Contains(PermissionKeys.AdminUsersManage, PermissionKeys.All);
        Assert.Contains(PermissionKeys.AdminStayOverrideDirtyCheckIn, PermissionKeys.All);
        Assert.Contains(PermissionKeys.AdminCustomerUnmaskPii, PermissionKeys.All);
        Assert.Contains(PermissionKeys.AdminInvoicesVoid, PermissionKeys.All);
        Assert.Contains(PermissionKeys.AdminRackView, PermissionKeys.All);
    }

    [Fact]
    public void AdminUser_AssignRoleAndScope_Should_Require_At_Least_One_AllowedPropertyId()
    {
        var user = new AdminUser
        {
            Username = "cashier.bkk",
            FullName = "Pimchanok Srisawat",
            Email = "pimchanok@tan-pms.internal",
            RoleCode = RoleCodes.FrontDeskCashier,
            RoleName = LocalizedText.Create("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier")
        };

        var ex = Assert.Throws<DomainRuleException>(() =>
            user.AssignRoleAndScope(
                RoleCodes.FrontDeskCashier,
                LocalizedText.Create("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier"),
                allowedPropertyIds: [],
                permissions: [PermissionKeys.AdminStayCheckIn],
                isActive: true));

        Assert.Equal(DomainErrorCodes.ValidationFailed, ex.ErrorCode);

        var propId = Guid.CreateVersion7();
        user.AssignRoleAndScope(
            RoleCodes.FrontDeskCashier,
            LocalizedText.Create("พนักงานต้อนรับและแคชเชียร์", "Front Desk & Cashier"),
            allowedPropertyIds: [propId, propId],
            permissions: [PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckIn],
            isActive: true);

        Assert.Single(user.AllowedPropertyIds);
        Assert.Single(user.Permissions);
    }

    [Fact]
    public void NotificationMessage_MarkAsRead_Should_Update_Read_State()
    {
        var message = new NotificationMessage
        {
            PropertyId = Guid.CreateVersion7(),
            CustomerId = Guid.CreateVersion7(),
            Channel = NotificationChannel.Line,
            TemplateKey = "invoice.issued",
            Title = LocalizedText.Create("แจ้งเตือนใบแจ้งหนี้ใหม่", "New Invoice Issued"),
            Body = LocalizedText.Create("ใบแจ้งหนี้ประจำเดือนพร้อมชำระแล้ว", "Your monthly invoice is ready.")
        };

        Assert.False(message.IsRead);
        message.MarkAsRead();
        Assert.True(message.IsRead);
    }
}
