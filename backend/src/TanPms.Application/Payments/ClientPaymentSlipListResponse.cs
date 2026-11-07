namespace TanPms.Application.Payments;

public sealed record ClientPaymentSlipListResponse(
    IReadOnlyList<ClientPaymentSlipDto> Items);
