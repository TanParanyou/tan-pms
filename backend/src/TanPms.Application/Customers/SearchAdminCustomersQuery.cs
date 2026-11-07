namespace TanPms.Application.Customers;

public sealed record SearchAdminCustomersQuery(
    Guid PropertyId,
    string? Search);
