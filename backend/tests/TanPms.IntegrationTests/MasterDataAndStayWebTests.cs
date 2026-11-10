using System.Net;
using System.Net.Http.Json;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Stays;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class MasterDataAndStayWebTests : IClassFixture<InMemoryWebApiFactory>
{
    private readonly InMemoryWebApiFactory _factory;

    public MasterDataAndStayWebTests(InMemoryWebApiFactory factory)
    {
        _factory = factory;
    }

    private HttpClient AdminOf(Guid propertyId, string userId, params string[] permissions)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        client.DefaultRequestHeaders.Add("X-TanPms-User-Id", userId);
        client.DefaultRequestHeaders.Add("X-TanPms-Open-Shift", "true");
        client.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", propertyId.ToString());
        client.DefaultRequestHeaders.Add("X-TanPms-Permissions", string.Join(",", permissions));
        return client;
    }

    [Fact]
    public async Task Master_Data_And_Stay_Endpoints_Should_Return_Conflict_Scope_And_Permission_Errors()
    {
        var bkkUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}";
        using var manager = AdminOf(PmsSeedConstants.BkkPropertyId, "web-manager",
            PermissionKeys.AdminPropertiesManage, PermissionKeys.AdminPropertiesRead, PermissionKeys.AdminRatesManage,
            PermissionKeys.AdminReservationsRead, PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckOut);

        var inUse = await manager.DeleteAsync($"{bkkUrl}/units/{PmsSeedConstants.OccupiedMonthlyUnitA201Id}");
        Assert.Equal(HttpStatusCode.Conflict, inUse.StatusCode);
        Assert.Contains("master_data.in_use", await inUse.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.Conflict, (await manager.DeleteAsync($"{bkkUrl}/rates/taxes/{PmsSeedConstants.MonthlyRentExemptTaxProfileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.GetAsync($"{bkkUrl}/units/{PmsSeedConstants.CleanUnitA101Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.GetAsync($"{bkkUrl}/rates/plans/{PmsSeedConstants.StandardRatePlanId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.GetAsync($"{bkkUrl}/reservations/{PmsSeedConstants.SampleConfirmedReservationId}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await manager.PostAsJsonAsync($"{bkkUrl}/buildings",
            new Application.Properties.UpsertBuildingRequest(null, "WEB-B", new LocalizedTextDto("อาคารเว็บ")))).StatusCode);

        using var cnxAdmin = AdminOf(PmsSeedConstants.CnxPropertyId, "web-cnx", PermissionKeys.AdminPropertiesRead);
        Assert.Equal(HttpStatusCode.Forbidden, (await cnxAdmin.GetAsync($"{bkkUrl}/units/{PmsSeedConstants.CleanUnitA101Id}")).StatusCode);

        var checkIn = await manager.PostAsJsonAsync("/api/v1/admin/stays/check-in", new CheckInStayRequest(
            PmsSeedConstants.BkkPropertyId, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 0m));
        var stay = await checkIn.Content.ReadFromJsonAsync<StaySummaryDto>();
        Assert.Equal(HttpStatusCode.OK, (await manager.GetAsync($"{bkkUrl}/stays/{stay!.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.PostAsJsonAsync(
            $"{bkkUrl}/stays/{stay.Id}/folio/payments/reverse", new ReverseFolioPaymentRequest(10m, "BankTransfer", "x"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await manager.PostAsJsonAsync($"{bkkUrl}/stays/{stay.Id}/cancel", new ReasonRequest(""))).StatusCode);
        var cancelled = await (await manager.PostAsJsonAsync($"{bkkUrl}/stays/{stay.Id}/cancel", new ReasonRequest("Keyed wrong room")))
            .Content.ReadFromJsonAsync<StayDetailDto>();
        Assert.Equal("Cancelled", cancelled!.Status);

        using var self = AdminOf(PmsSeedConstants.BkkPropertyId, PmsSeedConstants.BkkPropertyId.ToString(), PermissionKeys.AdminUsersManage);
        Assert.Equal(HttpStatusCode.BadRequest, (await self.PostAsJsonAsync(
            $"/api/v1/admin/users/{PmsSeedConstants.BkkPropertyId}/deactivate", new ReasonRequest("x"))).StatusCode);
    }
}
