using TanPms.Application.Billing;
using TanPms.Application.Common.Results;
using TanPms.Domain.Billing;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    public Result<ReceiptListResponse> GetAdminReceipts(Guid propertyId, Guid? invoiceId, bool unmaskPii = false)
    {
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<ReceiptListResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
            }

            var items = _receipts
                .Where(r => r.PropertyId == propertyId && (invoiceId == null || r.InvoiceId == invoiceId))
                .OrderByDescending(r => r.DocumentNumber, StringComparer.Ordinal)
                .Select(r => MapReceiptLocked(r, unmaskPii))
                .ToList();
            return Result<ReceiptListResponse>.Success(new ReceiptListResponse(items));
        }
    }

    public Result<ReceiptListResponse> GetClientReceipts(Guid customerId)
    {
        lock (_syncRoot)
        {
            var items = _receipts
                .Where(r => r.CustomerId == customerId)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => MapReceiptLocked(r, unmaskPii: false))
                .ToList();
            return Result<ReceiptListResponse>.Success(new ReceiptListResponse(items));
        }
    }

    public Result<ReceiptDocumentDto> GetAdminReceiptDocument(Guid propertyId, Guid receiptId, bool unmaskPii = false)
    {
        lock (_syncRoot)
        {
            var receipt = _receipts.FirstOrDefault(r => r.Id == receiptId && r.PropertyId == propertyId);
            return receipt is null
                ? Result<ReceiptDocumentDto>.Failure(ReceiptRules.NotFound(receiptId))
                : Result<ReceiptDocumentDto>.Success(BuildReceiptDocumentLocked(receipt, unmaskPii));
        }
    }

    public Result<ReceiptDocumentDto> GetClientReceiptDocument(Guid customerId, Guid receiptId)
    {
        lock (_syncRoot)
        {
            var receipt = _receipts.FirstOrDefault(r => r.Id == receiptId && r.CustomerId == customerId);
            return receipt is null
                ? Result<ReceiptDocumentDto>.Failure(ReceiptRules.ClientNotFound())
                : Result<ReceiptDocumentDto>.Success(BuildReceiptDocumentLocked(receipt, unmaskPii: false));
        }
    }

    private ReceiptDocumentDto BuildReceiptDocumentLocked(Receipt receipt, bool unmaskPii)
    {
        var letterhead = ReceiptRecordMapper.MapLetterhead(_properties[receipt.PropertyId]);
        var item = MapReceiptLocked(receipt, unmaskPii);
        if (receipt.InvoiceId is { } invoiceId)
        {
            return new ReceiptDocumentDto(letterhead, item, MapInvoiceLocked(_invoices.First(i => i.Id == invoiceId), unmaskPii), []);
        }

        var charges = _foliosByStayId.TryGetValue(receipt.StayId!.Value, out var folio)
            ? folio.Charges.Select(StayRecordMapper.MapCharge).ToList()
            : [];
        return new ReceiptDocumentDto(letterhead, item, null, charges);
    }

    private ReceiptItemDto MapReceiptLocked(Receipt receipt, bool unmaskPii)
    {
        var stay = receipt.StayId is { } stayId ? _stays.First(s => s.Id == stayId) : null;
        return ReceiptRecordMapper.MapReceipt(
            receipt,
            receipt.InvoiceId is { } invoiceId ? MapInvoiceLocked(_invoices.First(i => i.Id == invoiceId), unmaskPii) : null,
            stay is null ? null : (stay.DocumentNumber, _unitRefs[stay.UnitId]),
            _customers[receipt.CustomerId],
            unmaskPii);
    }
}
