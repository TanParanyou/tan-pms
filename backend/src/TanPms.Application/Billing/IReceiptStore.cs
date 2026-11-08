using TanPms.Application.Common.Results;

namespace TanPms.Application.Billing;

public interface IReceiptStore
{
    Result<ReceiptListResponse> GetAdminReceipts(Guid propertyId, Guid? invoiceId, bool unmaskPii = false);

    Result<ReceiptListResponse> GetClientReceipts(Guid customerId);

    Result<ReceiptDocumentDto> GetAdminReceiptDocument(Guid propertyId, Guid receiptId, bool unmaskPii = false);

    Result<ReceiptDocumentDto> GetClientReceiptDocument(Guid customerId, Guid receiptId);
}
