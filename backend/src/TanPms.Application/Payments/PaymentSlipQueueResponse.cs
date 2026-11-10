using TanPms.Application.Common.Models;
namespace TanPms.Application.Payments;

public sealed record PaymentSlipQueueResponse(
    IReadOnlyList<AdminPaymentSlipDto> Items,
    PaginationMetadata? Pagination = null);
