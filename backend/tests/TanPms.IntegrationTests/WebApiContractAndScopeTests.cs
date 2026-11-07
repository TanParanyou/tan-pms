using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Client;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Customers;
using TanPms.Application.Identity;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Notifications;
using TanPms.Application.Payments;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.ErrorHandling;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class WebApiContractAndScopeTests : IClassFixture<InMemoryWebApiFactory>
{
    private readonly InMemoryWebApiFactory _factory;

    public WebApiContractAndScopeTests(InMemoryWebApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Cors_Should_Allow_Localhost_3000_Frontend_Origin_With_Credentials()
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/auth/login");
        request.Headers.Add("Origin", "http://localhost:3000");
        request.Headers.Add("Access-Control-Request-Method", "POST");

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains("http://localhost:3000", response.Headers.GetValues("Access-Control-Allow-Origin"));
        Assert.Contains("true", response.Headers.GetValues("Access-Control-Allow-Credentials"));
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
    public async Task Admin_Leases_Should_Search_By_Plate_Validate_Create_And_Require_Settle_Permission()
    {
        using var managerClient = _factory.CreateClient();
        managerClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        managerClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        managerClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminLeasesManage);

        var listRes = await managerClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/leases?licensePlate={Uri.EscapeDataString("1กข 8899")}");
        Assert.Equal(HttpStatusCode.OK, listRes.StatusCode);
        var list = await listRes.Content.ReadFromJsonAsync<LeaseListResponse>();
        Assert.NotNull(list);
        var seedLease = Assert.Single(list.Items);
        Assert.Equal("A-201", seedLease.Unit.UnitNumber);
        Assert.Equal("1-xxxx-xxxxx-12-3", seedLease.Customer.MaskedNationalId);

        var byIdRes = await managerClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/leases/{seedLease.Id}");
        Assert.Equal(HttpStatusCode.OK, byIdRes.StatusCode);
        var byId = await byIdRes.Content.ReadFromJsonAsync<LeaseItemDto>();
        Assert.NotNull(byId);
        Assert.Equal(seedLease.DocumentNumber, byId.DocumentNumber);

        var missingRes = await managerClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/leases/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.BadRequest, missingRes.StatusCode);

        var customersRes = await managerClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/customers?search=somchai");
        Assert.Equal(HttpStatusCode.OK, customersRes.StatusCode);
        var customers = await customersRes.Content.ReadFromJsonAsync<CustomerListResponse>();
        Assert.NotNull(customers);
        Assert.Equal("1-xxxx-xxxxx-12-3", Assert.Single(customers.Items).MaskedNationalId);

        var deniedCustomersRes = await managerClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}/customers");
        Assert.Equal(HttpStatusCode.Forbidden, deniedCustomersRes.StatusCode);

        var invalidCreate = new CreateLeaseRequest(
            UnitId: PmsSeedConstants.DirtyUnitA102Id,
            CustomerId: PmsSeedConstants.SecondaryCustomerId,
            StartDate: new DateOnly(2026, 12, 1),
            EndDate: new DateOnly(2026, 11, 1),
            MonthlyRentAmount: 6500m,
            SecurityDepositAmount: 10000m,
            InitialWaterMeterReading: 0m,
            InitialElectricMeterReading: 0m);
        var invalidRes = await managerClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/leases",
            invalidCreate);
        Assert.Equal(HttpStatusCode.BadRequest, invalidRes.StatusCode);
        var invalidProblem = await invalidRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(invalidProblem);
        Assert.Equal(DomainErrorCodes.ValidationFailed, invalidProblem.ErrorCode);

        var settleRes = await managerClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/leases/{seedLease.Id}/settle-move-out",
            new SettleLeaseMoveOutRequest(0m, 0m, "Unauthorized attempt"));
        Assert.Equal(HttpStatusCode.Forbidden, settleRes.StatusCode);
        var settleProblem = await settleRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(settleProblem);
        Assert.Equal(DomainErrorCodes.PermissionDenied, settleProblem.ErrorCode);
    }

    [Fact]
    public async Task Meter_Sheet_Bulk_Save_Errors_And_Invoice_List_Should_Respect_Scope_And_Mask_Pii()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        client.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        client.DefaultRequestHeaders.Add(
            "X-TanPms-Permissions",
            $"{PermissionKeys.AdminMetersRecord},{PermissionKeys.AdminBillingIssueBatch}");
        var baseUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}";

        var sheet = await client.GetFromJsonAsync<MeterReadingSheetResponse>($"{baseUrl}/meter-readings?period=2026-11");
        Assert.NotNull(sheet);
        var row = Assert.Single(sheet.Rows, r => r.Unit.Id == PmsSeedConstants.OccupiedMonthlyUnitA201Id);
        Assert.True(row.IsLocked);
        Assert.Equal("1-xxxx-xxxxx-12-3", row.Customer.MaskedNationalId);

        // Locked period without override permission: 200 with row errors, nothing saved.
        var saveRes = await client.PutAsJsonAsync(
            $"{baseUrl}/meter-readings",
            new SaveMeterReadingsRequest("2026-11", [new MeterReadingInputDto(PmsSeedConstants.OccupiedMonthlyUnitA201Id, 10m, 20m)]));
        Assert.Equal(HttpStatusCode.OK, saveRes.StatusCode);
        var save = await saveRes.Content.ReadFromJsonAsync<SaveMeterReadingsResponse>();
        Assert.NotNull(save);
        Assert.False(save.IsSaved);
        Assert.Contains(save.Rows[0].Errors, e => e.Code == MeterReadingIssueCodes.PeriodLocked);

        var badPeriodRes = await client.GetAsync($"{baseUrl}/meter-readings?period=2026-13");
        Assert.Equal(HttpStatusCode.BadRequest, badPeriodRes.StatusCode);

        var invoices = await client.GetFromJsonAsync<InvoiceListResponse>($"{baseUrl}/invoices?period=2026-11");
        Assert.NotNull(invoices);
        var seeded = Assert.Single(invoices.Items);
        Assert.Equal("BKK01-INV-2611-0001", seeded.DocumentNumber);
        Assert.Equal("A-201", seeded.Unit!.UnitNumber);
        Assert.Equal("1-xxxx-xxxxx-12-3", seeded.Customer.MaskedNationalId);

        var deleteIssuedRes = await client.DeleteAsync($"{baseUrl}/invoices/{seeded.Id}");
        Assert.Equal(HttpStatusCode.Conflict, deleteIssuedRes.StatusCode);
        var deleteProblem = await deleteIssuedRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, deleteProblem!.ErrorCode);

        var deniedRes = await client.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}/invoices");
        Assert.Equal(HttpStatusCode.Forbidden, deniedRes.StatusCode);
    }

    [Fact]
    public async Task Cashier_Shift_And_Slip_Queue_Should_Enforce_Scope_Ownership_And_Reasons()
    {
        var cnxUrl = $"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}";
        using var cashier = _factory.CreateClient();
        cashier.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        cashier.DefaultRequestHeaders.Add("X-TanPms-User-Id", "it-cashier-cnx");
        cashier.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.CnxPropertyId.ToString());
        cashier.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminCashierOperateShift);

        var openRes = await cashier.PostAsJsonAsync($"{cnxUrl}/cashier/shifts/open", new OpenCashierShiftRequest(500m));
        Assert.Equal(HttpStatusCode.Created, openRes.StatusCode);
        var shift = await openRes.Content.ReadFromJsonAsync<CashierShiftDto>();
        Assert.Equal(HttpStatusCode.BadRequest, (await cashier.PostAsJsonAsync($"{cnxUrl}/cashier/shifts/open", new OpenCashierShiftRequest(1m))).StatusCode);

        var current = await cashier.GetFromJsonAsync<CurrentCashierShiftResponse>($"{cnxUrl}/cashier/shifts/current");
        Assert.Equal(shift!.Id, current!.Shift!.Id);

        var noRemarkRes = await cashier.PostAsJsonAsync($"{cnxUrl}/cashier/shifts/{shift.Id}/close", new CloseCashierShiftRequest(450m));
        Assert.Equal(HttpStatusCode.BadRequest, noRemarkRes.StatusCode);
        var closeRes = await cashier.PostAsJsonAsync($"{cnxUrl}/cashier/shifts/{shift.Id}/close", new CloseCashierShiftRequest(450m, "Short 50 THB"));
        Assert.Equal(HttpStatusCode.OK, closeRes.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await cashier.PostAsJsonAsync(
            $"{cnxUrl}/cashier/shifts/{shift.Id}/reconcile", new ReconcileCashierShiftRequest())).StatusCode);

        // Slip queue: submit as client (customer2), other customer is denied, reject requires a reason.
        using var admin = _factory.CreateClient();
        admin.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        admin.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        admin.DefaultRequestHeaders.Add(
            "X-TanPms-Permissions",
            $"{PermissionKeys.AdminPaymentsVerifySlip},{PermissionKeys.AdminBillingIssueBatch},{PermissionKeys.AdminCashierOperateShift}");
        var bkkUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}";
        var invoices = await admin.GetFromJsonAsync<InvoiceListResponse>($"{bkkUrl}/invoices");
        var invoice2 = invoices!.Items.Single(i => i.DocumentNumber == "BKK01-INV-2611-0002");

        using var customer1 = _factory.CreateClient();
        customer1.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer1.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.PrimaryCustomerId.ToString());
        Assert.Equal(HttpStatusCode.Forbidden, (await customer1.PostAsJsonAsync(
            $"/api/v1/client/invoices/{invoice2.Id}/slips", new SubmitPaymentSlipRequest(100m, "slips/it.jpg"))).StatusCode);

        using var customer2 = _factory.CreateClient();
        customer2.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer2.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.SecondaryCustomerId.ToString());
        var submitRes = await customer2.PostAsJsonAsync(
            $"/api/v1/client/invoices/{invoice2.Id}/slips", new SubmitPaymentSlipRequest(100m, "slips/it.jpg", "SCB-777"));
        Assert.Equal(HttpStatusCode.Created, submitRes.StatusCode);
        var slip = await submitRes.Content.ReadFromJsonAsync<ClientPaymentSlipDto>();

        var queue = await admin.GetFromJsonAsync<PaymentSlipQueueResponse>($"{bkkUrl}/payments/slips?status=Pending");
        var queued = Assert.Single(queue!.Items, i => i.Id == slip!.Id);
        Assert.Equal("3-xxxx-xxxxx-54-1", queued.Customer.MaskedNationalId);

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync(
            $"{bkkUrl}/payments/slips/{slip!.Id}/reject", new RejectPaymentSlipRequest(""))).StatusCode);
        var rejectRes = await admin.PostAsJsonAsync($"{bkkUrl}/payments/slips/{slip.Id}/reject", new RejectPaymentSlipRequest("Blurry slip"));
        Assert.Equal(HttpStatusCode.OK, rejectRes.StatusCode);

        var clientSlips = await customer2.GetFromJsonAsync<ClientPaymentSlipListResponse>($"/api/v1/client/invoices/{invoice2.Id}/slips");
        Assert.Contains(clientSlips!.Items, s => s.Id == slip.Id && s.Status == "Rejected");

        var ledgers = await admin.GetFromJsonAsync<DepositLedgerListResponse>($"{bkkUrl}/deposit-ledgers");
        Assert.NotNull(ledgers);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync($"{cnxUrl}/deposit-ledgers")).StatusCode);
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

    [Fact]
    public async Task Admin_Property_Hierarchy_Endpoint_Should_Enforce_Scope_And_Return_Hierarchy()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        client.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminPropertiesRead);
        client.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());

        var forbiddenRes = await client.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}/hierarchy");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenRes.StatusCode);
        var forbiddenProblem = await forbiddenRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(forbiddenProblem);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, forbiddenProblem.ErrorCode);

        var validRes = await client.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/hierarchy");
        Assert.Equal(HttpStatusCode.OK, validRes.StatusCode);
        var hierarchy = await validRes.Content.ReadFromJsonAsync<PropertyHierarchyResponse>();
        Assert.NotNull(hierarchy);
        Assert.Equal(PmsSeedConstants.BkkPropertyId, hierarchy.Property.Id);
        Assert.Equal("BKK01", hierarchy.Property.Code);
        Assert.Equal("00000", hierarchy.Property.TaxBranchCode);
        Assert.NotEmpty(hierarchy.Buildings);
        Assert.NotEmpty(hierarchy.UnitTypes);
        Assert.NotEmpty(hierarchy.Units);
        Assert.Contains(hierarchy.Units, u => u.Assets.Count > 0);
    }

    [Fact]
    public async Task Admin_Upsert_Unit_Master_Endpoint_Should_Create_And_Update_Unit_With_Assets()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        client.DefaultRequestHeaders.Add("X-TanPms-Permissions", $"{PermissionKeys.AdminPropertiesRead},{PermissionKeys.AdminPropertiesManage}");
        client.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());

        var req = new UpsertUnitMasterRequest(
            Id: null,
            BuildingId: PmsSeedConstants.BkkBuildingAId,
            FloorId: PmsSeedConstants.BkkFloor1Id,
            UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
            UnitNumber: "A-108",
            SupportedStayModes: ["Hourly", "Daily", "Monthly"],
            ConditionStatus: "Clean",
            Assets:
            [
                new UpsertUnitAssetItemDto(
                    "AST-A108-01",
                    new LocalizedTextDto("แอร์ Daikin 12000 BTU", "Daikin AC 12000 BTU"),
                    16500m),
                new UpsertUnitAssetItemDto(
                    "AST-A108-02",
                    new LocalizedTextDto("ตู้เย็น 1 ประตู", "1-Door Refrigerator"),
                    6500m)
            ]);

        var res = await client.PostAsJsonAsync($"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/units", req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var unit = await res.Content.ReadFromJsonAsync<UnitMasterItemDto>();
        Assert.NotNull(unit);
        Assert.Equal("A-108", unit.UnitNumber);
        Assert.Equal(2, unit.Assets.Count);
        Assert.Equal("AST-A108-01", unit.Assets[0].AssetCode);
        Assert.Equal("Clean", unit.ConditionStatus);
    }

    [Fact]
    public async Task Admin_Rates_Catalog_Upserts_And_Simulation_Should_Enforce_Permissions_And_Domain_Rules()
    {
        using var readOnlyClient = _factory.CreateClient();
        readOnlyClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        readOnlyClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminPropertiesRead);
        readOnlyClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());

        var forbiddenPropRes = await readOnlyClient.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}/rates");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenPropRes.StatusCode);

        var catalogRes = await readOnlyClient.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rates");
        Assert.Equal(HttpStatusCode.OK, catalogRes.StatusCode);
        var catalog = await catalogRes.Content.ReadFromJsonAsync<PropertyRateCatalogResponse>();
        Assert.NotNull(catalog);
        Assert.Equal("BKK01", catalog.Property.Code);
        Assert.NotEmpty(catalog.RatePlans);
        Assert.Equal(2, catalog.UtilityTariffs.Count);
        Assert.NotEmpty(catalog.TaxProfiles);

        var deniedPlanReq = new UpsertRatePlanRequest(
            Id: null,
            Code: "RP-CORP-2026",
            Name: new LocalizedTextDto("เรตลูกค้าองค์กร", "Corporate Rate Plan"),
            UnitTypeId: PmsSeedConstants.DeluxeUnitTypeId,
            SupportedStayModes: ["Daily", "Monthly"],
            HourlyPackage: new HourlyPackageConfigDto(3, 650m, 180m, 15, 1450m, 30),
            DailyRate: new DailyRateConfigDto(1450m, 1650m, 300m, 350m),
            MonthlyRate: new MonthlyRateConfigDto(9000m, 12, 2),
            IsActive: true);

        var deniedWriteRes = await readOnlyClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rates/plans",
            deniedPlanReq);
        Assert.Equal(HttpStatusCode.Forbidden, deniedWriteRes.StatusCode);

        using var rateAdminClient = _factory.CreateClient();
        rateAdminClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        rateAdminClient.DefaultRequestHeaders.Add("X-TanPms-Permissions", PermissionKeys.AdminRatesManage);
        rateAdminClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());

        var upsertPlanRes = await rateAdminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rates/plans",
            deniedPlanReq);
        Assert.Equal(HttpStatusCode.OK, upsertPlanRes.StatusCode);
        var createdPlan = await upsertPlanRes.Content.ReadFromJsonAsync<RatePlanItemDto>();
        Assert.NotNull(createdPlan);
        Assert.Equal("RP-CORP-2026", createdPlan.Code);

        var updateElectricReq = new UpsertUtilityTariffRequest(
            UtilityType: "Electric",
            Name: new LocalizedTextDto("ค่าไฟฟ้าเรตใหม่", "Updated Electricity Tariff"),
            BillingMode: "PerUnit",
            RatePerUnit: 8.50m,
            MinimumChargeAmount: 120.00m,
            IncludedUnits: 0.00m,
            BaseMinimumAmount: 0.00m,
            FlatRateAmount: 0.00m,
            FlatRatePerOccupant: false,
            MeterMaxDigits: 4);

        var tariffRes = await rateAdminClient.PutAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rates/utilities",
            updateElectricReq);
        Assert.Equal(HttpStatusCode.OK, tariffRes.StatusCode);
        var updatedTariff = await tariffRes.Content.ReadFromJsonAsync<UtilityTariffItemDto>();
        Assert.NotNull(updatedTariff);
        Assert.Equal(8.50m, updatedTariff.RatePerUnit);

        var invalidExemptTaxReq = new UpsertTaxProfileRequest(
            Id: null,
            ChargeCategoryCode: "INVALID_EXEMPT",
            Name: new LocalizedTextDto("ผิดกฎภาษี", "Invalid Tax"),
            TaxMode: "Exempt",
            VatRatePercent: 7.00m,
            DefaultWithholdingTaxPercent: 0.00m,
            IsActive: true);

        var invalidTaxRes = await rateAdminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rates/taxes",
            invalidExemptTaxReq);
        Assert.Equal(HttpStatusCode.BadRequest, invalidTaxRes.StatusCode);

        var validServiceTaxReq = new UpsertTaxProfileRequest(
            Id: null,
            ChargeCategoryCode: "LAUNDRY_SERVICE",
            Name: new LocalizedTextDto("ค่าบริการซักรีด", "Laundry Service"),
            TaxMode: "VatIncluded",
            VatRatePercent: 7.00m,
            DefaultWithholdingTaxPercent: 3.00m,
            IsActive: true);

        var validTaxRes = await rateAdminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rates/taxes",
            validServiceTaxReq);
        Assert.Equal(HttpStatusCode.OK, validTaxRes.StatusCode);
        var createdTax = await validTaxRes.Content.ReadFromJsonAsync<TaxProfileItemDto>();
        Assert.NotNull(createdTax);
        Assert.Equal("LAUNDRY_SERVICE", createdTax.ChargeCategoryCode);

        var simReq = new RateSimulationRequest(
            RatePlanId: createdPlan.Id,
            DurationMinutes: 256,
            WaterPreviousReading: 100m,
            WaterCurrentReading: 110m,
            WaterRolloverConfirmed: false,
            ElectricPreviousReading: 500m,
            ElectricCurrentReading: 520m,
            ElectricRolloverConfirmed: false,
            OccupantCount: 2,
            TaxProfileId: createdTax.Id,
            SampleLineAmount: 1070.00m,
            ApplyWithholdingTax: true);

        var simRes = await rateAdminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rates/simulate",
            simReq);
        Assert.Equal(HttpStatusCode.OK, simRes.StatusCode);
        var quote = await simRes.Content.ReadFromJsonAsync<RateSimulationResponse>();
        Assert.NotNull(quote);
        Assert.Equal(2, quote.HourlyQuote.ExtraHours);
        Assert.Equal(1010.00m, quote.HourlyQuote.FinalHourlyRoomCharge); // 650 + 2 * 180 = 1010
        Assert.Equal(190.00m, quote.WaterQuote.ChargeAmount); // 100 (first 5) + 5 * 18 = 190
        Assert.Equal(170.00m, quote.ElectricQuote.ChargeAmount); // 20 * 8.50 = 170
        Assert.Equal(1000.00m, quote.TaxQuote.SubTotal);
        Assert.Equal(70.00m, quote.TaxQuote.VatAmount);
        Assert.Equal(30.00m, quote.TaxQuote.WithholdingTaxAmount); // 3% of 1000
        Assert.Equal(1040.00m, quote.TaxQuote.NetPayable);
    }

    [Fact]
    public async Task Availability_Hold_Slip_Confirm_Assign_And_Cancel_Workflow_Should_Enforce_DualScope_Isolation_And_Audit()
    {
        var slotStart = new DateTimeOffset(2026, 12, 28, 14, 0, 0, TimeSpan.Zero);
        var slotEnd = new DateTimeOffset(2026, 12, 29, 12, 0, 0, TimeSpan.Zero);

        using var customer1Client = _factory.CreateClient();
        customer1Client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer1Client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.PrimaryCustomerId.ToString());

        var availUrl = $"/api/v1/client/availability?propertyId={PmsSeedConstants.BkkPropertyId}&stayMode=Daily&slotStartAt={Uri.EscapeDataString(slotStart.ToString("O"))}&slotEndAt={Uri.EscapeDataString(slotEnd.ToString("O"))}";
        var availRes = await customer1Client.GetAsync(availUrl);
        Assert.Equal(HttpStatusCode.OK, availRes.StatusCode);
        var avail = await availRes.Content.ReadFromJsonAsync<AvailabilitySearchResponse>();
        Assert.NotNull(avail);
        var stdAvail = Assert.Single(avail.Items, i => i.UnitType.Id == PmsSeedConstants.StandardUnitTypeId);
        Assert.True(stdAvail.NetAvailableQuota >= 1);

        var holdRes = await customer1Client.PostAsJsonAsync(
            "/api/v1/client/reservations/hold",
            new CreateClientHoldReservationRequest(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: null,
                StayMode: "Daily",
                SlotStartAt: slotStart,
                SlotEndAt: slotEnd));
        Assert.Equal(HttpStatusCode.Created, holdRes.StatusCode);
        var createdHold = await holdRes.Content.ReadFromJsonAsync<ReservationItemDto>();
        Assert.NotNull(createdHold);
        Assert.StartsWith("BKK01-RES-", createdHold.DocumentNumber, StringComparison.Ordinal);
        Assert.Equal("Hold", createdHold.Status);

        // Cross-customer isolation: SecondaryCustomer cannot see or submit slip for PrimaryCustomer's reservation
        using var customer2Client = _factory.CreateClient();
        customer2Client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        customer2Client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.SecondaryCustomerId.ToString());

        var customer2ListRes = await customer2Client.GetAsync("/api/v1/client/reservations");
        var customer2List = await customer2ListRes.Content.ReadFromJsonAsync<ReservationListResponse>();
        Assert.NotNull(customer2List);
        Assert.DoesNotContain(customer2List.Items, r => r.Id == createdHold.Id);

        var crossCustomerSlipRes = await customer2Client.PostAsJsonAsync(
            $"/api/v1/client/reservations/{createdHold.Id}/slip",
            new SubmitReservationSlipRequest("uploads/slips/spoofed.png"));
        Assert.Equal(HttpStatusCode.Forbidden, crossCustomerSlipRes.StatusCode);

        // PrimaryCustomer attaches slip -> PendingVerification
        var validSlipRes = await customer1Client.PostAsJsonAsync(
            $"/api/v1/client/reservations/{createdHold.Id}/slip",
            new SubmitReservationSlipRequest("uploads/slips/scb-slip-001.png"));
        Assert.Equal(HttpStatusCode.OK, validSlipRes.StatusCode);
        var pendingVerification = await validSlipRes.Content.ReadFromJsonAsync<ReservationItemDto>();
        Assert.NotNull(pendingVerification);
        Assert.Equal("PendingVerification", pendingVerification.Status);
        Assert.Equal("uploads/slips/scb-slip-001.png", pendingVerification.PaymentSlipFileKey);

        // Admin assigns specific unit, confirms slip, and later marks NoShow with mandatory reason
        using var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        adminClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        adminClient.DefaultRequestHeaders.Add(
            "X-TanPms-Permissions",
            $"{PermissionKeys.AdminReservationsRead},{PermissionKeys.AdminReservationsManage}");

        var assignRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/reservations/{createdHold.Id}/assign-unit",
            new AssignReservationUnitRequest(PmsSeedConstants.CleanUnitA101Id));
        Assert.Equal(HttpStatusCode.OK, assignRes.StatusCode);
        var assigned = await assignRes.Content.ReadFromJsonAsync<ReservationItemDto>();
        Assert.NotNull(assigned);
        Assert.Equal("A-101", assigned.AssignedUnit?.UnitNumber);

        var confirmRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/reservations/{createdHold.Id}/confirm",
            new { });
        Assert.Equal(HttpStatusCode.OK, confirmRes.StatusCode);
        var confirmed = await confirmRes.Content.ReadFromJsonAsync<ReservationItemDto>();
        Assert.NotNull(confirmed);
        Assert.Equal("Confirmed", confirmed.Status);

        var emptyReasonCancelRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/reservations/{createdHold.Id}/cancel",
            new CancelReservationRequest("", MarkNoShow: true));
        Assert.Equal(HttpStatusCode.BadRequest, emptyReasonCancelRes.StatusCode);

        var noShowRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/reservations/{createdHold.Id}/cancel",
            new CancelReservationRequest("Guest did not arrive within cut-off window", MarkNoShow: true));
        Assert.Equal(HttpStatusCode.OK, noShowRes.StatusCode);
        var noShow = await noShowRes.Content.ReadFromJsonAsync<ReservationItemDto>();
        Assert.NotNull(noShow);
        Assert.Equal("NoShow", noShow.Status);
        Assert.Equal("Guest did not arrive within cut-off window", noShow.CancellationReason);
    }

    [Fact]
    public async Task FrontDesk_Stay_Extend_Folio_CheckOut_DirtyUnit_And_RegulatoryExport_Should_Work_EndToEnd()
    {
        using var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        adminClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        adminClient.DefaultRequestHeaders.Add("X-TanPms-Open-Shift", "true");
        adminClient.DefaultRequestHeaders.Add(
            "X-TanPms-Permissions",
            string.Join(",",
                PermissionKeys.AdminPropertiesRead,
                PermissionKeys.AdminPropertiesManage,
                PermissionKeys.AdminStayCheckIn,
                PermissionKeys.AdminStayCheckOut,
                PermissionKeys.AdminRegulatoryExport));

        // 1. Provision dedicated clean unit A-109 so test execution order is completely isolated
        var unitRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/units",
            new UpsertUnitMasterRequest(
                Id: null,
                BuildingId: PmsSeedConstants.BkkBuildingAId,
                FloorId: PmsSeedConstants.BkkFloor1Id,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitNumber: "A-109",
                SupportedStayModes: ["Hourly", "Daily"],
                ConditionStatus: "Clean",
                Assets: []));
        Assert.Equal(HttpStatusCode.OK, unitRes.StatusCode);
        var unitA109 = await unitRes.Content.ReadFromJsonAsync<UnitMasterItemDto>();
        Assert.NotNull(unitA109);

        // 2. Quick Walk-in Check-in with Thai + Foreign co-occupants
        var checkInRes = await adminClient.PostAsJsonAsync(
            "/api/v1/admin/stays/check-in",
            new CheckInStayRequest(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitId: unitA109.Id,
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                StayMode: "Hourly",
                KeyDepositAmount: 500.00m,
                Occupants:
                [
                    new CheckInOccupantInputDto("Somchai Rakdee", "THA", "1100501234123", true, "9กท-9999"),
                    new CheckInOccupantInputDto("Mei Ling Tan", "SGP", "E9123456Z", false, null)
                ]));
        Assert.Equal(HttpStatusCode.Created, checkInRes.StatusCode);
        var createdStay = await checkInRes.Content.ReadFromJsonAsync<StaySummaryDto>();
        Assert.NotNull(createdStay);

        // 3. Extend stay +1h and post minibar charge to Folio
        var extendRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/stays/{createdStay.Id}/extend",
            new ExtendStayRequest(1));
        Assert.Equal(HttpStatusCode.OK, extendRes.StatusCode);

        var addChargeRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/stays/{createdStay.Id}/folio/charges",
            new AddFolioChargeRequest(
                new LocalizedTextDto("ชุดมินิบาร์", "Minibar Snack Set"),
                150.00m,
                "VatIncluded"));
        Assert.Equal(HttpStatusCode.OK, addChargeRes.StatusCode);
        var stayWithCharges = await addChargeRes.Content.ReadFromJsonAsync<StayDetailDto>();
        Assert.NotNull(stayWithCharges);
        Assert.Equal(800.00m, stayWithCharges.Folio.BalanceDue); // 500 base + 150 extend + 150 minibar

        // 4. Attempting check-out before settling Folio returns 409 stay.folio_unsettled
        var blockedCheckOutRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/stays/{createdStay.Id}/check-out",
            new CheckOutStayRequest(0m, "Attempt before settlement"));
        Assert.Equal(HttpStatusCode.Conflict, blockedCheckOutRes.StatusCode);
        var unsettledProblem = await blockedCheckOutRes.Content.ReadFromJsonAsync<ApiProblemDetails>();
        Assert.NotNull(unsettledProblem);
        Assert.Equal(DomainErrorCodes.StayFolioUnsettled, unsettledProblem.ErrorCode);

        // 5. Pay Folio in full and complete Check-out -> Unit becomes Dirty + HousekeepingTask Pending
        var payRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/stays/{createdStay.Id}/folio/payments",
            new RecordFolioPaymentRequest(800.00m, "Cash"));
        Assert.Equal(HttpStatusCode.OK, payRes.StatusCode);

        var checkOutRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/stays/{createdStay.Id}/check-out",
            new CheckOutStayRequest(0m, "Keycard returned intact; full 500 THB key deposit refunded"));
        Assert.Equal(HttpStatusCode.OK, checkOutRes.StatusCode);
        var checkedOutStay = await checkOutRes.Content.ReadFromJsonAsync<StayDetailDto>();
        Assert.NotNull(checkedOutStay);
        Assert.Equal("CheckedOut", checkedOutStay.Status);
        Assert.Equal(0.00m, checkedOutStay.KeyDepositBalance);
        Assert.Equal("Pending", checkedOutStay.GeneratedHousekeepingTaskStatus);

        // 6. Regulatory Export: masked TM.30 succeeds; unmasked requires admin.customer.unmask_pii (PDPA)
        var tm30MaskedRes = await adminClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/regulatory-exports?reportType=TM30&unmaskPii=false");
        Assert.Equal(HttpStatusCode.OK, tm30MaskedRes.StatusCode);
        var tm30Masked = await tm30MaskedRes.Content.ReadFromJsonAsync<RegulatoryExportResponse>();
        Assert.NotNull(tm30Masked);
        Assert.All(tm30Masked.Rows, r => Assert.NotEqual("THA", r.NationalityCode));
        Assert.Contains(tm30Masked.Rows, r => r.FullName == "Mei Ling Tan" && r.IdentityNumber == "E9xxxx56Z");

        var deniedUnmaskRes = await adminClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/regulatory-exports?reportType=TM30&unmaskPii=true");
        Assert.Equal(HttpStatusCode.Forbidden, deniedUnmaskRes.StatusCode);

        using var dpoClient = _factory.CreateClient();
        dpoClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        dpoClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        dpoClient.DefaultRequestHeaders.Add(
            "X-TanPms-Permissions",
            $"{PermissionKeys.AdminRegulatoryExport},{PermissionKeys.AdminCustomerUnmaskPii}");

        var unmaskedRes = await dpoClient.GetAsync(
            $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/regulatory-exports?reportType=TM30&unmaskPii=true");
        Assert.Equal(HttpStatusCode.OK, unmaskedRes.StatusCode);
        var tm30Unmasked = await unmaskedRes.Content.ReadFromJsonAsync<RegulatoryExportResponse>();
        Assert.NotNull(tm30Unmasked);
        Assert.True(tm30Unmasked.IsPiiUnmasked);
        Assert.Contains(tm30Unmasked.Rows, r => r.FullName == "Mei Ling Tan" && r.IdentityNumber == "E9123456Z");
    }
}
