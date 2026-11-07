using TanPms.Application.Common.Results;

namespace TanPms.Application.Billing;

public interface IBillingStore
{
    Result<BatchInvoiceRunResponse> RunAdminBatchInvoices(
        Guid propertyId,
        BatchInvoiceRunRequest request,
        DateTimeOffset? nowUtc = null);

    Result<InvoiceListResponse> GetAdminInvoices(
        Guid propertyId,
        string? period,
        string? status,
        bool unmaskPii = false);

    Result<InvoiceIssueResponse> IssueAdminInvoicesForPeriod(
        Guid propertyId,
        IssueInvoicesRequest request);

    Result<InvoiceItemDto> IssueAdminInvoice(
        Guid propertyId,
        Guid invoiceId);

    Result<InvoiceItemDto> DeleteAdminInvoice(
        Guid propertyId,
        Guid invoiceId);
}
