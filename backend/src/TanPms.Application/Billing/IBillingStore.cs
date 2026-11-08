using TanPms.Application.Common.Contracts;
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

    Result<InvoiceItemDto> GetAdminInvoice(Guid propertyId, Guid invoiceId, bool unmaskPii = false);

    Result<InvoiceItemDto> AddAdminInvoiceLine(Guid propertyId, Guid invoiceId, InvoiceLineRequest request);

    Result<InvoiceItemDto> UpdateAdminInvoiceLine(Guid propertyId, Guid invoiceId, Guid lineId, InvoiceLineRequest request);

    Result<InvoiceItemDto> DeleteAdminInvoiceLine(Guid propertyId, Guid invoiceId, Guid lineId);

    Result<InvoiceItemDto> VoidAdminInvoice(Guid propertyId, Guid invoiceId, ReasonRequest request);
}
