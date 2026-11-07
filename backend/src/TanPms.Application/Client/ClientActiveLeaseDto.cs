using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Client;

public sealed record ClientActiveLeaseDto(
    string DocumentNumber,
    UnitRefDto Unit,
    decimal MonthlyRentAmount,
    decimal SecurityDepositBalance);
