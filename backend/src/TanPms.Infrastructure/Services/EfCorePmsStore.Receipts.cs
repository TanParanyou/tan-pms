using Microsoft.EntityFrameworkCore;
using TanPms.Application.Billing;
using TanPms.Application.Common.Results;
using TanPms.Domain.Billing;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public Result<ReceiptListResponse> GetAdminReceipts(Guid propertyId, Guid? invoiceId, bool unmaskPii = false)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<ReceiptListResponse>.Failure(MeterBillingComposer.PropertyNotFound(propertyId));
        }

        var receipts = _dbContext.Receipts.AsNoTracking()
            .Where(r => r.PropertyId == propertyId && (invoiceId == null || r.InvoiceId == invoiceId))
            .OrderByDescending(r => r.DocumentNumber)
            .ToList();
        return Result<ReceiptListResponse>.Success(new ReceiptListResponse(MapReceipts(receipts, unmaskPii)));
    }

    public Result<ReceiptListResponse> GetClientReceipts(Guid customerId)
    {
        var receipts = _dbContext.Receipts.AsNoTracking()
            .Where(r => r.CustomerId == customerId)
            .OrderByDescending(r => r.CreatedAt)
            .ToList();
        return Result<ReceiptListResponse>.Success(new ReceiptListResponse(MapReceipts(receipts, unmaskPii: false)));
    }

    public Result<ReceiptDocumentDto> GetAdminReceiptDocument(Guid propertyId, Guid receiptId, bool unmaskPii = false)
    {
        var receipt = _dbContext.Receipts.AsNoTracking().FirstOrDefault(r => r.Id == receiptId && r.PropertyId == propertyId);
        return receipt is null
            ? Result<ReceiptDocumentDto>.Failure(ReceiptRules.NotFound(receiptId))
            : Result<ReceiptDocumentDto>.Success(BuildReceiptDocument(receipt, unmaskPii));
    }

    public Result<ReceiptDocumentDto> GetClientReceiptDocument(Guid customerId, Guid receiptId)
    {
        var receipt = _dbContext.Receipts.AsNoTracking().FirstOrDefault(r => r.Id == receiptId && r.CustomerId == customerId);
        return receipt is null
            ? Result<ReceiptDocumentDto>.Failure(ReceiptRules.ClientNotFound())
            : Result<ReceiptDocumentDto>.Success(BuildReceiptDocument(receipt, unmaskPii: false));
    }

    private ReceiptDocumentDto BuildReceiptDocument(Receipt receipt, bool unmaskPii)
    {
        var invoice = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines).First(i => i.Id == receipt.InvoiceId);
        var invoiceDto = MapInvoices(receipt.PropertyId, [invoice], unmaskPii)[0];
        var customer = _dbContext.Customers.AsNoTracking().First(c => c.Id == receipt.CustomerId);
        var property = _dbContext.Properties.AsNoTracking().First(p => p.Id == receipt.PropertyId);
        return new ReceiptDocumentDto(
            ReceiptRecordMapper.MapLetterhead(property),
            ReceiptRecordMapper.MapReceipt(receipt, invoiceDto, customer, unmaskPii),
            invoiceDto);
    }

    private List<ReceiptItemDto> MapReceipts(IReadOnlyList<Receipt> receipts, bool unmaskPii)
    {
        var invoiceIds = receipts.Select(r => r.InvoiceId).Distinct().ToList();
        var customerIds = receipts.Select(r => r.CustomerId).Distinct().ToList();
        var invoices = _dbContext.Invoices.AsNoTracking().Include(i => i.Lines).Where(i => invoiceIds.Contains(i.Id)).ToList();
        var invoiceDtos = invoices
            .GroupBy(i => i.PropertyId)
            .SelectMany(g => MapInvoices(g.Key, g.ToList(), unmaskPii))
            .ToDictionary(i => i.Id);
        var customers = _dbContext.Customers.AsNoTracking().Where(c => customerIds.Contains(c.Id)).ToDictionary(c => c.Id);
        return receipts
            .Select(r => ReceiptRecordMapper.MapReceipt(r, invoiceDtos[r.InvoiceId], customers[r.CustomerId], unmaskPii))
            .ToList();
    }
}
