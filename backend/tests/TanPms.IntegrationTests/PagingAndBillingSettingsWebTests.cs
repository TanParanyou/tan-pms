using System.Net;
using System.Net.Http.Json;
using TanPms.Application.Billing;
using TanPms.Application.Notifications;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.IntegrationTests;

public sealed class PagingAndBillingSettingsWebTests : IClassFixture<InMemoryWebApiFactory>
{
    private readonly InMemoryWebApiFactory _factory;

    public PagingAndBillingSettingsWebTests(InMemoryWebApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Paging_Billing_Settings_And_Logout_Should_Work_Over_Http()
    {
        var bkkUrl = $"/api/v1/admin/properties/{PmsSeedConstants.BkkPropertyId}";
        using var admin = _factory.CreateClient();
        admin.DefaultRequestHeaders.Add("X-TanPms-Scope", "admin");
        admin.DefaultRequestHeaders.Add("X-TanPms-Allowed-Properties", PmsSeedConstants.BkkPropertyId.ToString());
        admin.DefaultRequestHeaders.Add("X-TanPms-Permissions", string.Join(",", PermissionKeys.AdminBillingIssueBatch, PermissionKeys.AdminPropertiesManage));

        var unpaged = await admin.GetFromJsonAsync<InvoiceListResponse>($"{bkkUrl}/invoices");
        Assert.Null(unpaged!.Pagination);
        var paged = await admin.GetFromJsonAsync<InvoiceListResponse>($"{bkkUrl}/invoices?page=2&pageSize=1");
        Assert.Single(paged!.Items);
        Assert.Equal(unpaged.Items.Count, paged.Pagination!.TotalCount);
        Assert.Equal(unpaged.Items[1].Id, paged.Items[0].Id);

        Assert.Equal(7, (await admin.GetFromJsonAsync<BillingSettingsDto>($"{bkkUrl}/billing-settings"))!.EffectivePaymentTermsDays);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"{bkkUrl}/billing-settings", new UpdateBillingSettingsRequest(400))).StatusCode);
        Assert.Equal(30, (await (await admin.PutAsJsonAsync($"{bkkUrl}/billing-settings", new UpdateBillingSettingsRequest(30)))
            .Content.ReadFromJsonAsync<BillingSettingsDto>())!.EffectivePaymentTermsDays);

        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-TanPms-Scope", "client");
        client.DefaultRequestHeaders.Add("X-TanPms-Customer-Id", PmsSeedConstants.PrimaryCustomerId.ToString());
        var feed = await client.GetFromJsonAsync<NotificationListResponse>("/api/v1/client/notifications?pageSize=1");
        Assert.Equal(1, feed!.Pagination!.PageSize);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/v1/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/v1/client/files/slips/legacy.jpg")).StatusCode);
    }
}
