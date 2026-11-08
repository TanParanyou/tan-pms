using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Domain.Billing;
using TanPms.Domain.Customers;
using TanPms.Domain.Properties;

namespace TanPms.Infrastructure.Services;

// Shared by the EF Core and in-memory stores so receipt lists and PDF payloads project identically.
internal static class ReceiptRecordMapper
{
    internal static ReceiptItemDto MapReceipt(Receipt receipt, InvoiceItemDto invoice, Customer customer, bool unmaskPii) => new(
        receipt.Id,
        receipt.DocumentNumber,
        receipt.InvoiceId,
        invoice.DocumentNumber,
        new CustomerRefDto(customer.Id, customer.FullName, unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity()),
        invoice.Unit,
        receipt.InvoiceTotalAmount,
        receipt.WithholdingTaxAmount,
        receipt.WhtCertificateNumber,
        receipt.NetPayableAmount,
        receipt.IsCashPayment,
        receipt.CreatedAt);

    internal static PropertyLetterheadDto MapLetterhead(Property property) => new(
        property.Code,
        LocalizedTextDto.FromDomain(property.Name),
        property.Address is null ? null : LocalizedTextDto.FromDomain(property.Address),
        property.TaxBranchCode);
}
