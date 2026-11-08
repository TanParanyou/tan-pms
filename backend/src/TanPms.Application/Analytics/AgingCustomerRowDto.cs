using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Analytics;

public sealed record AgingCustomerRowDto(
    CustomerRefDto Customer,
    int InvoiceCount,
    AgingBucketsDto Buckets);
