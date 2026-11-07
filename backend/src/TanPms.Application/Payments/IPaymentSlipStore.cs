using TanPms.Application.Common.Results;

namespace TanPms.Application.Payments;

public interface IPaymentSlipStore
{
    Result<ClientPaymentSlipDto> SubmitClientPaymentSlip(
        Guid customerId,
        Guid invoiceId,
        SubmitPaymentSlipRequest request,
        DateTimeOffset? nowUtc = null);

    Result<ClientPaymentSlipListResponse> GetClientInvoiceSlips(Guid customerId, Guid invoiceId);

    Result<PaymentSlipQueueResponse> GetAdminPaymentSlips(Guid propertyId, string? status, bool unmaskPii = false);

    Result<AdminPaymentSlipDto> ApproveAdminPaymentSlip(
        Guid propertyId,
        Guid slipId,
        string reviewerUserId,
        DateTimeOffset? nowUtc = null);

    Result<AdminPaymentSlipDto> RejectAdminPaymentSlip(
        Guid propertyId,
        Guid slipId,
        string reviewerUserId,
        RejectPaymentSlipRequest request,
        DateTimeOffset? nowUtc = null);
}
