namespace TanPms.Application.Billing;

public sealed record ReceiptListResponse(
    IReadOnlyList<ReceiptItemDto> Items);
