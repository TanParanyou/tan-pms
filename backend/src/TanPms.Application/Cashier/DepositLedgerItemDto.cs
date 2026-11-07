using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Cashier;

public sealed record DepositLedgerItemDto(
    Guid Id,
    string DepositType,
    string? OwnerDocumentNumber,
    CustomerRefDto Customer,
    UnitRefDto? Unit,
    decimal CurrentBalance,
    IReadOnlyList<DepositTransactionDto> Transactions);
