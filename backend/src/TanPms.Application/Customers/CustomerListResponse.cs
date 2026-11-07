using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Customers;

public sealed record CustomerListResponse(
    IReadOnlyList<CustomerRefDto> Items);
