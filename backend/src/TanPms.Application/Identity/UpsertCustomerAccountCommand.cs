namespace TanPms.Application.Identity;

public sealed record UpsertCustomerAccountCommand(
    Guid CustomerId,
    CustomerAccountRequest Request);
