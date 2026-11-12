using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Meters;
using TanPms.Application.Rates;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

// Utility VAT is a staff-editable TaxProfile: batch drafts read the CURRENT profile at run time, Issued invoices never change.
public sealed class UtilityVatChangeTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;
    private static readonly Guid A201 = PmsSeedConstants.OccupiedMonthlyUnitA201Id;

    [Fact]
    public void Changing_The_Water_Tax_Profile_Should_Reprice_Draft_Lines_But_Never_Issued_Invoices()
    {
        var store = new InMemoryOperationalService();
        Assert.True(store.SaveAdminMeterReadings(Bkk, new SaveMeterReadingsRequest("2026-10",
            [new MeterReadingInputDto(A201, 12m, 80m, false, false, null)]), false).Value!.IsSaved);

        var draft = store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!.Created.Single(i => i.Unit!.Id == A201);
        var water = draft.Lines[1];
        Assert.Equal("VatIncluded", water.TaxMode);
        Assert.True(water.VatAmount > 0m);

        var profile = store.GetPropertyRateCatalog(Bkk).Value!.TaxProfiles.Single(t => t.ChargeCategoryCode == "UTILITY_WATER");

        var exempt = Reprice(store, profile, "Exempt", 0m, draft.Id);
        Assert.Equal("Exempt", exempt.Lines[1].TaxMode);
        Assert.Equal(0m, exempt.Lines[1].VatAmount);
        Assert.Equal(water.LineAmount, exempt.Lines[1].NetAmount);

        var excluded = Reprice(store, profile, "VatExcluded", 7m, draft.Id);
        Assert.Equal("VatExcluded", excluded.Lines[1].TaxMode);
        Assert.Equal(decimal.Round(water.LineAmount * 0.07m, 2, MidpointRounding.AwayFromZero), excluded.Lines[1].VatAmount);
        Assert.Equal(water.LineAmount + excluded.Lines[1].VatAmount, excluded.Lines[1].NetAmount);

        var excluded10 = Reprice(store, profile, "VatExcluded", 10m, draft.Id);
        Assert.Equal("VatExcluded", excluded10.Lines[1].TaxMode);
        Assert.Equal(water.LineAmount, excluded10.Lines[1].SubTotal);
        Assert.Equal(decimal.Round(water.LineAmount * 0.10m, 2, MidpointRounding.AwayFromZero), excluded10.Lines[1].VatAmount);
        Assert.Equal(water.LineAmount + excluded10.Lines[1].VatAmount, excluded10.Lines[1].NetAmount);

        var included10 = Reprice(store, profile, "VatIncluded", 10m, draft.Id);
        Assert.Equal("VatIncluded", included10.Lines[1].TaxMode);
        var expectedSub10 = decimal.Round(water.LineAmount / 1.10m, 2, MidpointRounding.AwayFromZero);
        Assert.Equal(expectedSub10, included10.Lines[1].SubTotal);
        Assert.Equal(water.LineAmount - expectedSub10, included10.Lines[1].VatAmount);
        Assert.Equal(water.LineAmount, included10.Lines[1].NetAmount);

        var included = Reprice(store, profile, "VatIncluded", 7m, draft.Id);
        Assert.Equal(water, included.Lines[1] with { Id = water.Id });

        // Issued invoices are snapshots: a later profile change and a re-run leave them untouched.
        Assert.True(store.IssueAdminInvoice(Bkk, draft.Id).IsSuccess);
        var issued = store.GetAdminInvoice(Bkk, draft.Id).Value!;
        store.UpsertTaxProfile(Bkk, Request(profile, "Exempt", 0m));
        var rerun = store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!;
        Assert.DoesNotContain(rerun.Refreshed, i => i.Id == draft.Id);
        Assert.Equal(issued.TotalAmount, store.GetAdminInvoice(Bkk, draft.Id).Value!.TotalAmount);
        Assert.Equal(issued.Lines.Select(l => l.TaxMode), store.GetAdminInvoice(Bkk, draft.Id).Value!.Lines.Select(l => l.TaxMode));
    }

    private static InvoiceItemDto Reprice(InMemoryOperationalService store, TaxProfileItemDto profile, string mode, decimal rate, Guid invoiceId)
    {
        Assert.True(store.UpsertTaxProfile(Bkk, Request(profile, mode, rate)).IsSuccess);
        var run = store.RunAdminBatchInvoices(Bkk, new BatchInvoiceRunRequest("2026-10")).Value!;
        return run.Refreshed.Single(i => i.Id == invoiceId);
    }

    private static UpsertTaxProfileRequest Request(TaxProfileItemDto p, string mode, decimal rate) =>
        new(p.Id, p.ChargeCategoryCode, p.Name, mode, rate, p.DefaultWithholdingTaxPercent, p.IsActive);
}
