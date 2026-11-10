using System.Globalization;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TanPms.Application.Billing;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Leases;
using TanPms.Domain.Rates;

namespace TanPms.Infrastructure.Pdf;

// QuestPDF renderer for printable documents. Thai text uses the embedded Sarabun font
// (Copyright 2018 The Sarabun Project Authors, SIL Open Font License 1.1 - see Pdf/Fonts/OFL.txt, not printed on documents);
// labels are bilingual (th / en)
// because the PDF is a legal document, not a localized UI screen.
public sealed class QuestPdfDocumentRenderer : IPdfDocumentRenderer
{
    private const string FontFamily = "Sarabun";
    private static readonly Lazy<bool> FontsRegistered = new(RegisterFonts);

    public QuestPdfDocumentRenderer()
    {
        _ = FontsRegistered.Value;
    }

    public byte[] RenderLeaseContract(LeaseContractDto contract)
    {
        var lease = contract.Lease;
        return Document.Create(container => container.Page(page =>
        {
            ConfigurePage(page);
            page.Header().Element(c => Letterhead(c, contract.Property, "สัญญาเช่าห้องพัก / Lease Agreement", lease.DocumentNumber));
            page.Content().PaddingVertical(10).Column(col =>
            {
                col.Spacing(8);
                col.Item().Element(c => Section(c, "คู่สัญญา / Parties", rows =>
                {
                    rows.Add(("ผู้เช่า / Tenant", lease.Customer.FullName));
                    rows.Add(("เลขประจำตัว / ID", lease.Customer.MaskedNationalId));
                    rows.Add(("ห้อง / Unit", $"{lease.Unit.UnitNumber} ({lease.Unit.BuildingName.Th}, ชั้น {lease.Unit.FloorNumber})"));
                    rows.Add(("ประเภทห้อง / Unit type", lease.Unit.UnitTypeName.Th));
                }));
                col.Item().Element(c => Section(c, "เงื่อนไขสัญญา / Terms", rows =>
                {
                    rows.Add(("ระยะเวลา / Term", $"{FormatDate(lease.StartDate)} - {FormatDate(lease.EndDate)}"));
                    rows.Add(("ค่าเช่ารายเดือน / Monthly rent", Money(lease.MonthlyRentAmount)));
                    rows.Add(("เงินประกัน / Security deposit", Money(lease.SecurityDepositAmount)));
                    rows.Add(("มิเตอร์น้ำเริ่มต้น / Initial water meter", lease.InitialWaterMeterReading.ToString("0.##", CultureInfo.InvariantCulture)));
                    rows.Add(("มิเตอร์ไฟเริ่มต้น / Initial electric meter", lease.InitialElectricMeterReading.ToString("0.##", CultureInfo.InvariantCulture)));
                }));
                col.Item().Text("ผู้พักอาศัย / Occupants").Bold();
                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c => { c.RelativeColumn(3); c.RelativeColumn(2); c.RelativeColumn(1); });
                    HeaderRow(table, "ชื่อ / Name", "เลขประจำตัว / ID", "ผู้พักหลัก / Primary");
                    foreach (var occupant in lease.Occupants)
                    {
                        BodyRow(table, occupant.FullName, occupant.MaskedIdentityNumber, occupant.IsPrimaryOccupant ? "/" : "-");
                    }
                });
                col.Item().Text("ยานพาหนะ / Vehicles").Bold();
                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c => { c.RelativeColumn(2); c.RelativeColumn(2); c.RelativeColumn(2); });
                    HeaderRow(table, "ทะเบียน / Plate", "จังหวัด / Province", "ยี่ห้อรุ่น / Model");
                    foreach (var vehicle in lease.Vehicles)
                    {
                        BodyRow(table, vehicle.LicensePlate, vehicle.Province, vehicle.VehicleBrandModel);
                    }
                });
                col.Item().PaddingTop(40).Row(row =>
                {
                    row.RelativeItem().Element(c => SignatureBlock(c, "ผู้ให้เช่า / Lessor", contract.Property.Name.Th));
                    row.ConstantItem(40);
                    row.RelativeItem().Element(c => SignatureBlock(c, "ผู้เช่า / Lessee", lease.Customer.FullName));
                });
            });
            page.Footer().AlignCenter().Text(t => { t.CurrentPageNumber(); t.Span(" / "); t.TotalPages(); });
        })).GeneratePdf();
    }

    public byte[] RenderReceipt(ReceiptDocumentDto document)
    {
        var receipt = document.Receipt;
        return Document.Create(container => container.Page(page =>
        {
            ConfigurePage(page);
            page.Header().Element(c => Letterhead(c, document.Property, "ใบเสร็จรับเงิน / Receipt", receipt.DocumentNumber));
            page.Content().PaddingVertical(10).Column(col =>
            {
                col.Spacing(8);
                col.Item().Element(c => Section(c, "รายละเอียด / Details", rows =>
                {
                    rows.Add(("ได้รับเงินจาก / Received from", receipt.Customer.FullName));
                    rows.Add(("เลขประจำตัว / ID", receipt.Customer.MaskedNationalId));
                    rows.Add(("ห้อง / Unit", receipt.Unit?.UnitNumber ?? "-"));
                    rows.Add(receipt.InvoiceDocumentNumber is { } invoiceNumber
                        ? ("อ้างอิงใบแจ้งหนี้ / Invoice", invoiceNumber)
                        : ("อ้างอิงการเข้าพัก / Stay", receipt.StayDocumentNumber ?? "-"));
                    rows.Add(("วันที่ / Date", FormatDate(DateOnly.FromDateTime(receipt.IssuedAt.UtcDateTime))));
                    rows.Add(("วิธีชำระ / Method", receipt.IsCashPayment ? "เงินสด / Cash" : "โอน / Transfer"));
                }));
                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c => { c.RelativeColumn(4); c.RelativeColumn(1); c.RelativeColumn(1); c.RelativeColumn(1); });
                    HeaderRow(table, "รายการ / Description", "ก่อนภาษี / Net", "VAT", "รวม / Total");
                    if (document.Invoice is { } invoice)
                    {
                        foreach (var line in invoice.Lines)
                        {
                            BodyRow(table, line.Description.Th, Money(line.SubTotal), Money(line.VatAmount), Money(line.NetAmount));
                        }
                    }
                    else
                    {
                        foreach (var charge in document.FolioCharges.Where(c => !c.IsVoided))
                        {
                            var tax = ThaiTaxCalculator.CalculateLine(charge.Amount, Enum.Parse<TaxMode>(charge.TaxMode));
                            BodyRow(table, charge.Description.Th, Money(tax.SubTotal), Money(tax.VatAmount), Money(tax.TotalAmount));
                        }
                    }
                });
                col.Item().AlignRight().Column(totals =>
                {
                    totals.Item().Text($"ยอดใบแจ้งหนี้ / Invoice total: {Money(receipt.InvoiceTotalAmount)}");
                    totals.Item().Text($"ภาษีหัก ณ ที่จ่าย / WHT: {Money(receipt.WithholdingTaxAmount)}");
                    totals.Item().Text($"รับชำระสุทธิ / Net received: {Money(receipt.NetPayableAmount)}").Bold();
                });
                col.Item().PaddingTop(40).AlignRight().Width(220).Element(c => SignatureBlock(c, "ผู้รับเงิน / Collector", document.Property.Name.Th));
            });
        })).GeneratePdf();
    }

    private static bool RegisterFonts()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var assembly = typeof(QuestPdfDocumentRenderer).Assembly;
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase)))
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            FontManager.RegisterFontFromStream(stream);
        }

        return true;
    }

    private static void ConfigurePage(PageDescriptor page)
    {
        page.Size(PageSizes.A4);
        page.Margin(36);
        page.DefaultTextStyle(x => x.FontFamily(FontFamily).FontSize(10));
    }

    private static void Letterhead(IContainer container, PropertyLetterheadDto property, string title, string documentNumber) =>
        container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingBottom(8).Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text(property.Name.Th).FontSize(14).Bold();
                if (property.Address is { } address)
                {
                    col.Item().Text(address.Th);
                }

                col.Item().Text($"สาขา / Branch: {property.TaxBranchCode}");
            });
            row.ConstantItem(200).AlignRight().Column(col =>
            {
                col.Item().AlignRight().Text(title).FontSize(13).Bold();
                col.Item().AlignRight().Text(documentNumber);
            });
        });

    private static void Section(IContainer container, string title, Action<List<(string Label, string Value)>> fill)
    {
        var rows = new List<(string Label, string Value)>();
        fill(rows);
        container.Column(col =>
        {
            col.Item().Text(title).Bold();
            foreach (var (label, value) in rows)
            {
                col.Item().Row(row =>
                {
                    row.ConstantItem(190).Text(label).FontColor(Colors.Grey.Darken2);
                    row.RelativeItem().Text(value);
                });
            }
        });
    }

    private static void HeaderRow(TableDescriptor table, params string[] cells)
    {
        foreach (var cell in cells)
        {
            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten1).PaddingVertical(3).Text(cell).Bold();
        }
    }

    private static void BodyRow(TableDescriptor table, params string[] cells)
    {
        foreach (var cell in cells)
        {
            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten3).PaddingVertical(3).Text(cell);
        }
    }

    private static void SignatureBlock(IContainer container, string role, string name) =>
        container.Column(col =>
        {
            col.Item().PaddingTop(20).BorderBottom(1).BorderColor(Colors.Grey.Darken1).Height(1);
            col.Item().AlignCenter().Text($"({name})");
            col.Item().AlignCenter().Text(role).FontColor(Colors.Grey.Darken2);
            col.Item().AlignCenter().Text("วันที่ / Date ........................");
        });

    private static string Money(decimal amount) => amount.ToString("#,##0.00", CultureInfo.InvariantCulture);

    private static string FormatDate(DateOnly date) => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
}
