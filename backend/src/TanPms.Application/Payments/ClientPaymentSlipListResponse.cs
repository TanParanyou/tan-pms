using TanPms.Application.Common.Models;
namespace TanPms.Application.Payments;

public sealed record ClientPaymentSlipListResponse(
    IReadOnlyList<ClientPaymentSlipDto> Items,
    PaginationMetadata? Pagination = null);
