using TanPms.Application.Billing;
using TanPms.Application.Leases;

namespace TanPms.Application.Common.Abstractions;

public interface IPdfDocumentRenderer
{
    byte[] RenderLeaseContract(LeaseContractDto contract);

    byte[] RenderReceipt(ReceiptDocumentDto receipt);
}
