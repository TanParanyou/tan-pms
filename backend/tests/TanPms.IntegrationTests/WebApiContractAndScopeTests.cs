using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TanPms.Application.ClientPortal;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Identity;
using TanPms.Application.Notifications;
using TanPms.Application.Rack;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.ErrorHandling;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class WebApiContractAndScopeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public WebApiContractAndScopeTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_Endpoints_Should_Return_200_Ok()
    {
        using var client = _factory.CreateClient();

        var live = await client.GetAsync("/health/live");
        var ready = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
    }

    [Fact]
    public async Task Auth_Login_And_Me_Should_Return_Session_For_Valid_Credentials_And_401_For_Wrong_Password()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("Accept-Language", "en-US");

        var invalidRes = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new LoginRequest("admin", "naphat.admin", "wrong-password"));
        Assert.Equal(HttpStatusCode.Unauthorized, invalidRes.StatusCode);

        var invalidProblem = await invalidRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(invalidProblem);
        Assert.Equal(DomainErrorCodes.InvalidCredentials, invalidProblem.ErrorCode);
        Assert.Equal("Invalid credentials", invalidProblem.Title);

        var validAdminRes = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new LoginRequest("admin", "naphat.admin", "demo-pass-123"));
        Assert.Equal(HttpStatusCode.OK, validAdminRes.StatusCode);

        var session = await validAdminRes.Content.ReadFromJsonAsync<AuthSessionResponse>();
        Assert.NotNull(session);
        Assert.Equal("admin", session.Scope);
        Assert.Equal(RoleCodes.OrganizationAdmin, session.RoleCode);
        Assert.NotEmpty(session.AllowedProperties);
        Assert.Contains(PermissionKeys.AdminUsersManage, session.Permissions);

        var meRes = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, meRes.StatusCode);
    }

    [Fact]
    public async Task Admin_Users_And_Roles_Should_Enforce_PropertyScope_Permission_And_Record_AuditEvent()
    {
        using var bkkOnlyClient = _factory.CreateClient();
        bkkOnlyClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        bkkOnlyClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        bkkOnlyClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminUsersRead);

        var rolesRes = await bkkOnlyClient.GetAsync("/api/v1/admin/roles");
        Assert.Equal(HttpStatusCode.OK, rolesRes.StatusCode);
        var catalog = await rolesRes.Content.ReadFromJsonAsync<RoleCatalogResponse>();
        Assert.NotNull(catalog);
        Assert.Equal(7, catalog.Roles.Count);
        Assert.Equal(25, catalog.Permissions.Count);

        var deniedScopeRes = await bkkOnlyClient.GetAsync($"/api/v1/admin/users?propertyId={PmsSeedConstants.CnxPropertyId}");
        Assert.Equal(HttpStatusCode.Forbidden, deniedScopeRes.StatusCode);
        var scopeProblem = await deniedScopeRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(scopeProblem);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, scopeProblem.ErrorCode);

        var upsertReq = new UpsertAdminUserRequest(
            Id: null,
            Username: "arthit.bkk",
            FullName: "Arthit Charoen",
            Email: "arthit@tan-pms.internal",
            RoleCode: RoleCodes.FrontDeskCashier,
            AllowedPropertyIds: [PmsSeedConstants.BkkPropertyId],
            IsActive: true);

        var noManagePermRes = await bkkOnlyClient.PostAsJsonAsync("/api/v1/admin/users", upsertReq);
        Assert.Equal(HttpStatusCode.Forbidden, noManagePermRes.StatusCode);
        var permProblem = await noManagePermRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(permProblem);
        Assert.Equal(DomainErrorCodes.PermissionDenied, permProblem.ErrorCode);

        using var adminManagerClient = _factory.CreateClient();
        adminManagerClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        adminManagerClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        adminManagerClient.DefaultRequestHeaders.Add(
            "X-TanPms-Permissions",
            $"{PermissionKeys.AdminUsersRead},{PermissionKeys.AdminUsersManage}");

        var createdUserRes = await adminManagerClient.PostAsJsonAsync("/api/v1/admin/users", upsertReq);
        Assert.Equal(HttpStatusCode.OK, createdUserRes.StatusCode);
        var createdUser = await createdUserRes.Content.ReadFromJsonAsync<AdminUserDto>();
        Assert.NotNull(createdUser);
        Assert.Equal("arthit.bkk", createdUser.Username);
        Assert.Equal(RoleCodes.FrontDeskCashier, createdUser.RoleCode);

        var operationalService = _factory.Services.GetRequiredService<InMemoryOperationalService>();
        Assert.Contains(operationalService.AuditEvents, e =>
            e.ActionKey == PermissionKeys.AdminUsersManage && e.EntityId == createdUser.Id);
    }

    [Fact]
    public async Task Notifications_Dispatch_And_Client_Feed_Should_Isolate_By_CustomerId()
    {
        using var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        adminClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());

        var dispatchReq = new DispatchNotificationRequest(
            PropertyId: PmsSeedConstants.BkkPropertyId,
            CustomerId: PmsSeedConstants.PrimaryCustomerId,
            Channel: "Line",
            TemplateKey: "invoice.issued",
            Title: new LocalizedTextDto("แจ้งใบแจ้งหนี้รอบใหม่", "New Monthly Invoice Issued"),
            Body: new LocalizedTextDto("ใบแจ้งหนี้ BKK01-INV-2611-0001 พร้อมชำระ", "Invoice BKK01-INV-2611-0001 is ready."));

        var dispatchRes = await adminClient.PostAsJsonAsync("/api/v1/admin/notifications/dispatch", dispatchReq);
        Assert.Equal(HttpStatusCode.Created, dispatchRes.StatusCode);

        using var customer1Client = _factory.CreateClient();
        customer1Client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer1Client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.PrimaryCustomerId.ToString());

        var list1Res = await customer1Client.GetAsync("/api/v1/client/notifications");
        Assert.Equal(HttpStatusCode.OK, list1Res.StatusCode);
        var list1 = await list1Res.Content.ReadFromJsonAsync<NotificationListResponse>();
        Assert.NotNull(list1);
        Assert.Contains(list1.Items, n => n.TemplateKey == "invoice.issued" && n.Title.Th == "แจ้งใบแจ้งหนี้รอบใหม่");

        using var customer2Client = _factory.CreateClient();
        customer2Client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer2Client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.SecondaryCustomerId.ToString());

        var list2Res = await customer2Client.GetAsync("/api/v1/client/notifications");
        Assert.Equal(HttpStatusCode.OK, list2Res.StatusCode);
        var list2 = await list2Res.Content.ReadFromJsonAsync<NotificationListResponse>();
        Assert.NotNull(list2);
        Assert.Empty(list2.Items);
    }

    [Fact]
    public async Task Admin_RoomRack_Should_Return_StructuredProjections_With_LocalizedText_And_403_For_UnauthorizedProperty()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        client.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        client.DefaultRequestHeaders.Add("Accept-Language", "th-TH");

        var allowedResponse = await client.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rack");
        Assert.Equal(HttpStatusCode.OK, allowedResponse.StatusCode);

        var rack = await allowedResponse.Content.ReadFromJsonAsync<RoomRackResponse>();
        Assert.NotNull(rack);
        Assert.Equal("BKK01", rack.Property.Code);
        Assert.Equal("แทน เรสซิเดนซ์ รัชดา", rack.Property.Name.Th);
        Assert.Equal("TAN Residence Ratchada", rack.Property.Name.En);
        Assert.NotEmpty(rack.Items);
        Assert.All(rack.Items, item =>
        {
            Assert.False(string.IsNullOrWhiteSpace(item.Unit.UnitNumber));
            Assert.False(string.IsNullOrWhiteSpace(item.Unit.BuildingName.Th));
            Assert.False(string.IsNullOrWhiteSpace(item.Unit.UnitTypeName.Th));
        });

        var deniedResponse = await client.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}/rack");
        Assert.Equal(HttpStatusCode.Forbidden, deniedResponse.StatusCode);
        Assert.Equal("application/problem+json", deniedResponse.Content.Headers.ContentType?.MediaType);

        var problem = await deniedResponse.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(problem);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, problem.ErrorCode);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, problem.Code);
        Assert.Equal(403, problem.Status);
        Assert.Equal("ไม่มีสิทธิ์เข้าถึงสาขาที่ระบุ", problem.Title);
        Assert.False(string.IsNullOrWhiteSpace(problem.TraceId));
    }

    [Fact]
    public async Task Admin_CheckInStay_Should_Enforce_OpenShift_DirtyUnitRule_OverridePermission_And_Succeed_On_CleanUnit()
    {
        using var noShiftClient = _factory.CreateClient();
        noShiftClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        noShiftClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        noShiftClient.DefaultRequestHeaders.Add("X-TanPms-Open-Shift", "false");
        noShiftClient.DefaultRequestHeaders.Add("Accept-Language", "en-US");

        var noShiftReq = new CheckInStayRequest(
            PropertyId: PmsSeedConstants.BkkPropertyId,
            UnitId: PmsSeedConstants.CleanUnitA101Id,
            CustomerId: PmsSeedConstants.PrimaryCustomerId,
            StayMode: "Hourly",
            KeyDepositAmount: 200.00m);

        var noShiftRes = await noShiftClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", noShiftReq);
        Assert.Equal(HttpStatusCode.Conflict, noShiftRes.StatusCode);
        var noShiftProblem = await noShiftRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(noShiftProblem);
        Assert.Equal(DomainErrorCodes.ShiftNotOpen, noShiftProblem.ErrorCode);
        Assert.Equal("Cashier shift is not open", noShiftProblem.Title);

        using var cashierClient = _factory.CreateClient();
        cashierClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        cashierClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        cashierClient.DefaultRequestHeaders.Add("X-TanPms-Open-Shift", "true");

        var dirtyReq = new CheckInStayRequest(
            PropertyId: PmsSeedConstants.BkkPropertyId,
            UnitId: PmsSeedConstants.DirtyUnitA102Id,
            CustomerId: PmsSeedConstants.PrimaryCustomerId,
            StayMode: "Hourly",
            KeyDepositAmount: 200.00m,
            OverrideDirtyCheckIn: false);

        var dirtyRes = await cashierClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", dirtyReq);
        Assert.Equal(HttpStatusCode.Conflict, dirtyRes.StatusCode);
        var dirtyProblem = await dirtyRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(dirtyProblem);
        Assert.Equal(DomainErrorCodes.UnitNotClean, dirtyProblem.ErrorCode);

        var cleanRes = await cashierClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", noShiftReq);
        Assert.Equal(HttpStatusCode.Created, cleanRes.StatusCode);
        var createdStay = await cleanRes.Content.ReadFromJsonAsync<StaySummaryDto>();
        Assert.NotNull(createdStay);
        Assert.StartsWith("BKK01-STY-", createdStay.DocumentNumber, StringComparison.Ordinal);
        Assert.Equal("A-101", createdStay.Unit.UnitNumber);
        Assert.Equal("อาคาร A", createdStay.Unit.BuildingName.Th);
        Assert.Equal("Building A", createdStay.Unit.BuildingName.En);
        Assert.Equal("1-xxxx-xxxxx-12-3", createdStay.Customer.MaskedNationalId);
    }

    [Fact]
    public async Task Client_Dashboard_Should_Isolate_Data_By_CurrentUser_CustomerId()
    {
        using var customer1Client = _factory.CreateClient();
        customer1Client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer1Client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.PrimaryCustomerId.ToString());

        var res1 = await customer1Client.GetAsync("/api/v1/client/dashboard");
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var dash1 = await res1.Content.ReadFromJsonAsync<ClientDashboardResponse>();
        Assert.NotNull(dash1);
        Assert.Equal(PmsSeedConstants.PrimaryCustomerId, dash1.Customer.Id);
        Assert.Equal("1-xxxx-xxxxx-12-3", dash1.Customer.MaskedNationalId);
        Assert.NotNull(dash1.ActiveLease);
        Assert.Equal("ดีลักซ์ 32 ตร.ม.", dash1.ActiveLease!.Unit.UnitTypeName.Th);
        Assert.Equal("Deluxe 32 sqm", dash1.ActiveLease.Unit.UnitTypeName.En);
        Assert.Single(dash1.UnpaidInvoices);
        Assert.Equal("BKK01-INV-2611-0001", dash1.UnpaidInvoices[0].DocumentNumber);
        Assert.Single(dash1.PendingParcels);

        using var customer2Client = _factory.CreateClient();
        customer2Client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer2Client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.SecondaryCustomerId.ToString());

        var res2 = await customer2Client.GetAsync("/api/v1/client/dashboard");
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var dash2 = await res2.Content.ReadFromJsonAsync<ClientDashboardResponse>();
        Assert.NotNull(dash2);
        Assert.Equal(PmsSeedConstants.SecondaryCustomerId, dash2.Customer.Id);
        Assert.Null(dash2.ActiveLease);
        Assert.Empty(dash2.PendingParcels);
        Assert.Single(dash2.UnpaidInvoices);
        Assert.Equal("BKK01-INV-2611-0002", dash2.UnpaidInvoices[0].DocumentNumber);
    }
}
