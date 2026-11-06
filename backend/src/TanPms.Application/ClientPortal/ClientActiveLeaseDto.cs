using TanPms.Application.Common.Contracts;

namespace TanPms.Application.ClientPortal;

public sealed record ClientActiveLeaseDto(
    string DocumentNumber,
    UnitRefDto Unit,
    decimal MonthlyRentAmount,
    decimal SecurityDepositBalance);
