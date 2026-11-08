using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Analytics;

public sealed record CashierShiftSummaryRowDto(
    UserRefDto Cashier,
    int ShiftCount,
    decimal CashReceiptsTotal,
    decimal VarianceTotal);
