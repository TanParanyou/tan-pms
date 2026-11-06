using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using TanPms.Application.Contracts;
using TanPms.Domain.Exceptions;
using TanPms.Infrastructure.Services;
using TanPms.WebApi.Infrastructure;
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
    public async Task Admin_RoomRack_Should_Return_StructuredProjections_For_AllowedProperty_And_403_For_UnauthorizedProperty()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        client.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());

        var allowedResponse = await client.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/rack");
        Assert.Equal(HttpStatusCode.OK, allowedResponse.StatusCode);

        var rack = await allowedResponse.Content.ReadFromJsonAsync<RoomRackResponse>();
        Assert.NotNull(rack);
        Assert.Equal("BKK01", rack.Property.Code);
        Assert.NotEmpty(rack.Items);
        Assert.All(rack.Items, item =>
        {
            Assert.False(string.IsNullOrWhiteSpace(item.Unit.UnitNumber));
            Assert.False(string.IsNullOrWhiteSpace(item.Unit.BuildingName));
            Assert.False(string.IsNullOrWhiteSpace(item.Unit.UnitTypeName));
        });

        var deniedResponse = await client.GetAsync($"/api/v1/admin/properties/{PmsSeedConstants.CnxPropertyId}/rack");
        Assert.Equal(HttpStatusCode.Forbidden, deniedResponse.StatusCode);
        Assert.Equal("application/problem+json", deniedResponse.Content.Headers.ContentType?.MediaType);

        var problem = await deniedResponse.Content.ReadFromJsonAsync<Rfc9457ProblemDetailsResponse>();
        Assert.NotNull(problem);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, problem.ErrorCode);
        Assert.Equal(403, problem.Status);
        Assert.False(string.IsNullOrWhiteSpace(problem.TraceId));
    }

    [Fact]
    public async Task Admin_CheckInStay_Should_Enforce_OpenShift_DirtyUnitRule_OverridePermission_And_Succeed_On_CleanUnit()
    {
        using var noShiftClient = _factory.CreateClient();
        noShiftClient.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        noShiftClient.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        noShiftClient.DefaultRequestHeaders.Add("X-TanPms-Open-Shift", "false");

        var noShiftReq = new CheckInStayRequest(
            PropertyId: PmsSeedConstants.BkkPropertyId,
            UnitId: PmsSeedConstants.CleanUnitA101Id,
            CustomerId: PmsSeedConstants.PrimaryCustomerId,
            StayMode: "Hourly",
            KeyDepositAmount: 200.00m);

        var noShiftRes = await noShiftClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", noShiftReq);
        Assert.Equal(HttpStatusCode.Conflict, noShiftRes.StatusCode);
        var noShiftProblem = await noShiftRes.Content.ReadFromJsonAsync<Rfc9457ProblemDetailsResponse>();
        Assert.NotNull(noShiftProblem);
        Assert.Equal(DomainErrorCodes.ShiftNotOpen, noShiftProblem.ErrorCode);

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
        var dirtyProblem = await dirtyRes.Content.ReadFromJsonAsync<Rfc9457ProblemDetailsResponse>();
        Assert.NotNull(dirtyProblem);
        Assert.Equal(DomainErrorCodes.UnitNotClean, dirtyProblem.ErrorCode);

        var cleanRes = await cashierClient.PostAsJsonAsync("/api/v1/admin/stays/check-in", noShiftReq);
        Assert.Equal(HttpStatusCode.Created, cleanRes.StatusCode);
        var createdStay = await cleanRes.Content.ReadFromJsonAsync<StaySummaryDto>();
        Assert.NotNull(createdStay);
        Assert.StartsWith("BKK01-STY-", createdStay.DocumentNumber, StringComparison.Ordinal);
        Assert.Equal("A-101", createdStay.Unit.UnitNumber);
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
