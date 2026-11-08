using System.Net;
using System.Net.Http.Json;
using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Leases;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class ClientSelfServiceAndAnalyticsWebTests : IClassFixture<InMemoryWebApiFactory>
{
    private readonly InMemoryWebApiFactory _factory;

    public ClientSelfServiceAndAnalyticsWebTests(InMemoryWebApiFactory factory)
    {
        _factory = factory;
    }

    private HttpClient ClientOf(Guid customerId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", customerId.ToString());
        return client;
    }

    private HttpClient AdminOf(Guid propertyId, params string[] permissions)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        client.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", propertyId.ToString());
        client.DefaultRequestHeaders.Add("X-TanPms-Permissions", string.Join(",", permissions));
        return client;
    }

    [Fact]
    public async Task Client_Self_Service_And_Lease_Intents_Should_Enforce_Customer_Isolation()
    {
        using var customer1 = ClientOf(PmsSeedConstants.PrimaryCustomerId);
        using var customer2 = ClientOf(PmsSeedConstants.SecondaryCustomerId);
        var lease = Assert.Single((await customer1.GetFromJsonAsync<LeaseListResponse>("/api/v1/client/leases"))!.Items);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer2.GetAsync($"/api/v1/client/leases/{lease.Id}")).StatusCode);

        var invoice = Assert.Single((await customer1.GetFromJsonAsync<ClientInvoiceListResponse>("/api/v1/client/invoices"))!.Items);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer2.GetAsync($"/api/v1/client/invoices/{invoice.Invoice.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await customer1.GetAsync("/api/v1/client/payment-slips")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer2.GetAsync($"/api/v1/client/utility-usage?leaseId={lease.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer2.GetAsync($"/api/v1/client/reservations/{PmsSeedConstants.SampleHoldReservationId}")).StatusCode);

        var created = await customer1.PostAsJsonAsync(
            $"/api/v1/client/leases/{lease.Id}/intents", new CreateLeaseIntentRequest("Renew", new DateOnly(2027, 3, 31)));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var intent = await created.Content.ReadFromJsonAsync<LeaseIntentDto>();
        Assert.Equal(HttpStatusCode.Forbidden, (await customer2.PutAsJsonAsync(
            $"/api/v1/client/lease-intents/{intent!.Id}", new UpdateLeaseIntentRequest(new DateOnly(2027, 4, 30)))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer2.DeleteAsync($"/api/v1/client/lease-intents/{intent.Id}")).StatusCode);

        var bkkUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}";
        using var cnxAdmin = AdminOf(PmsSeedConstants.CnxPropertyId, PermissionKeys.AdminLeasesManage);
        Assert.Equal(HttpStatusCode.Forbidden, (await cnxAdmin.PostAsync($"{bkkUrl}/lease-intents/{intent.Id}/approve", null)).StatusCode);
        using var leaseAdmin = AdminOf(PmsSeedConstants.BkkPropertyId, PermissionKeys.AdminLeasesManage);
        Assert.Contains((await leaseAdmin.GetFromJsonAsync<LeaseIntentListResponse>($"{bkkUrl}/lease-intents?status=Pending"))!.Items, i => i.Id == intent.Id);
        var approved = await leaseAdmin.PostAsync($"{bkkUrl}/lease-intents/{intent.Id}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        Assert.Equal(new DateOnly(2027, 3, 31), (await customer1.GetFromJsonAsync<LeaseItemDto>($"/api/v1/client/leases/{lease.Id}"))!.EndDate);
    }

    [Fact]
    public async Task Analytics_Endpoints_Should_Require_Permission_And_Property_Scope()
    {
        var bkkUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}/analytics";
        using var analyst = AdminOf(PmsSeedConstants.BkkPropertyId, PermissionKeys.AdminAnalyticsRead);
        var occupancy = await analyst.GetFromJsonAsync<OccupancyReportDto>($"{bkkUrl}/occupancy?from=2026-10-01&to=2026-10-31");
        Assert.Equal(93, occupancy!.AvailableUnitNights);
        Assert.Equal(33, occupancy.OccupiedUnitNights);
        foreach (var report in new[] { "revpar", "receivables-aging", "cashier-shifts", "deposits" })
        {
            Assert.Equal(HttpStatusCode.OK, (await analyst.GetAsync($"{bkkUrl}/{report}")).StatusCode);
        }

        using var noPermission = AdminOf(PmsSeedConstants.BkkPropertyId, PermissionKeys.AdminLeasesManage);
        Assert.Equal(HttpStatusCode.Forbidden, (await noPermission.GetAsync($"{bkkUrl}/occupancy")).StatusCode);
        using var cnxAnalyst = AdminOf(PmsSeedConstants.CnxPropertyId, PermissionKeys.AdminAnalyticsRead);
        Assert.Equal(HttpStatusCode.Forbidden, (await cnxAnalyst.GetAsync($"{bkkUrl}/revpar")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await analyst.GetAsync($"{bkkUrl}/occupancy?from=2026-10-31&to=2026-10-01")).StatusCode);
    }
}
