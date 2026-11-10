using TanPms.Application.Billing;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Cashier;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Customers;
using TanPms.Domain.Properties;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

// Shared by the EF Core and in-memory stores so receipt lists and PDF payloads project identically.
internal static class ReceiptRecordMapper
{
    internal static ReceiptItemDto MapReceipt(
        Receipt receipt,
        InvoiceItemDto? invoice,
        (string DocumentNumber, UnitRefDto Unit)? stay,
        Customer customer,
        bool unmaskPii) => new(
        receipt.Id,
        receipt.DocumentNumber,
        receipt.InvoiceId,
        invoice?.DocumentNumber,
        new CustomerRefDto(customer.Id, customer.FullName, unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity()),
        receipt.StayId.HasValue ? stay?.Unit : invoice?.Unit,
        receipt.InvoiceTotalAmount,
        receipt.WithholdingTaxAmount,
        receipt.WhtCertificateNumber,
        receipt.NetPayableAmount,
        receipt.IsCashPayment,
        receipt.CreatedAt,
        receipt.StayId,
        stay?.DocumentNumber,
        receipt.PaymentMethod);

    internal static Receipt BuildFolioReceipt(Stay stay, Folio folio, string documentNumber, decimal amount, string paymentMethod, CashierShift? shift, string? cashierUserId) => new()
    {
        PropertyId = stay.PropertyId,
        DocumentNumber = documentNumber,
        StayId = stay.Id,
        CustomerId = stay.CustomerId,
        CashierShiftId = paymentMethod == PaymentMethods.Cash ? shift?.Id : null,
        InvoiceTotalAmount = folio.TotalCharges,
        NetPayableAmount = amount,
        IsCashPayment = paymentMethod == PaymentMethods.Cash,
        PaymentMethod = paymentMethod,
        CashierUserId = cashierUserId
    };

    internal static PropertyLetterheadDto MapLetterhead(Property property) => new(
        property.Code,
        LocalizedTextDto.FromDomain(property.Name),
        property.Address is null ? null : LocalizedTextDto.FromDomain(property.Address),
        property.TaxBranchCode);
}
