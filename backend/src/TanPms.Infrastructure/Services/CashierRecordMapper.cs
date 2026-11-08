using TanPms.Application.Cashier;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Payments;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;

namespace TanPms.Infrastructure.Services;

// Shared by the EF Core and in-memory stores so shift, slip and deposit projections stay identical.
internal static class CashierRecordMapper
{
    internal static CashierShiftDto MapShift(CashierShift shift, Func<string?, UserRefDto?> users) => new(
        shift.Id,
        shift.DocumentNumber,
        shift.CashierUserId,
        shift.Status.ToString(),
        shift.OpeningFloatCash,
        shift.CashReceiptsInShift,
        shift.CashDepositsReceivedInShift,
        shift.CashDepositsRefundedInShift,
        shift.ExpectedDrawerCash,
        shift.ActualCashCounted,
        shift.CashVariance,
        shift.VarianceRemark,
        shift.CreatedAt,
        users(shift.CashierUserId)!,
        shift.CancelReason);

    internal static ClientPaymentSlipDto MapClientSlip(PaymentSlip slip, string invoiceDocumentNumber) => new(
        slip.Id,
        slip.PropertyId,
        slip.InvoiceId,
        invoiceDocumentNumber,
        slip.Amount,
        slip.TransferReference,
        slip.TransferredAt,
        slip.SlipFileKey,
        slip.Status.ToString(),
        slip.CreatedAt,
        slip.RejectReason);

    internal static AdminPaymentSlipDto MapAdminSlip(
        PaymentSlip slip,
        Invoice invoice,
        decimal outstanding,
        Customer customer,
        UnitRefDto? unitRef,
        string? receiptDocumentNumber,
        bool unmaskPii,
        Func<string?, UserRefDto?> users) => new(
        slip.Id,
        invoice.Id,
        invoice.DocumentNumber,
        invoice.Status.ToString(),
        invoice.TotalAmount,
        outstanding,
        MapCustomer(customer, unmaskPii),
        unitRef,
        slip.Amount,
        slip.TransferReference,
        slip.TransferredAt,
        slip.SlipFileKey,
        slip.Status.ToString(),
        slip.CreatedAt,
        slip.ReviewedByUserId,
        slip.ReviewedAt,
        slip.RejectReason,
        receiptDocumentNumber,
        users(slip.ReviewedByUserId));

    internal static DepositLedgerItemDto MapLedger(
        DepositLedger ledger,
        string? ownerDocumentNumber,
        Customer customer,
        UnitRefDto? unitRef,
        bool unmaskPii) => new(
        ledger.Id,
        ledger.DepositType.ToString(),
        ownerDocumentNumber,
        MapCustomer(customer, unmaskPii),
        unitRef,
        ledger.CurrentBalance,
        ledger.Transactions
            .OrderBy(t => t.CreatedAt)
            .Select(t => new DepositTransactionDto(
                t.Id,
                t.DocumentNumber,
                t.TransactionType.ToString(),
                t.Amount,
                t.Reason,
                t.CreatedAt))
            .ToList());

    internal static PaymentSlip BuildSlip(Invoice invoice, Guid customerId, SubmitPaymentSlipRequest request) => new()
    {
        PropertyId = invoice.PropertyId,
        InvoiceId = invoice.Id,
        CustomerId = customerId,
        Amount = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero),
        SlipFileKey = request.SlipFileKey.Trim(),
        TransferReference = string.IsNullOrWhiteSpace(request.TransferReference) ? null : request.TransferReference.Trim(),
        TransferredAt = request.TransferredAt
    };

    internal static Receipt BuildSlipReceipt(Invoice invoice, PaymentSlip slip, string documentNumber) => new()
    {
        PropertyId = invoice.PropertyId,
        DocumentNumber = documentNumber,
        InvoiceId = invoice.Id,
        CustomerId = invoice.CustomerId,
        PaymentSlipId = slip.Id,
        InvoiceTotalAmount = invoice.TotalAmount,
        NetPayableAmount = slip.Amount,
        IsCashPayment = false
    };

    internal static Error ShiftNotFound(Guid propertyId, Guid shiftId) =>
        new(DomainErrorCodes.ValidationFailed, $"Cashier shift '{shiftId}' was not found in property '{propertyId}'.");

    internal static Error SlipNotFound(Guid propertyId, Guid slipId) =>
        new(DomainErrorCodes.ValidationFailed, $"Payment slip '{slipId}' was not found in property '{propertyId}'.");

    internal static Error ShiftOwnedByAnotherCashier() =>
        new(DomainErrorCodes.PermissionDenied, "Only the cashier who opened the shift can close it.");

    internal static Error LedgerNotFound(Guid propertyId, Guid ledgerId) =>
        new(DomainErrorCodes.ValidationFailed, $"Deposit ledger '{ledgerId}' was not found in property '{propertyId}'.");

    internal static Error ShiftHasReceipts(string documentNumber) =>
        new(DomainErrorCodes.ValidationFailed, $"CashierShift {documentNumber} has receipts and must be closed instead of cancelled.");

    internal static Error ShiftAlreadyOpen() =>
        new(DomainErrorCodes.ValidationFailed, "Cashier already has an Open shift in this property.");

    private static CustomerRefDto MapCustomer(Customer customer, bool unmaskPii) => new(
        customer.Id,
        customer.FullName,
        unmaskPii ? customer.NationalIdOrPassport : customer.GetMaskedIdentity());
}
