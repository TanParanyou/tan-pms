using TanPms.Application.Common.Results;

namespace TanPms.Application.Cashier;

public interface IDepositLedgerStore
{
    Result<DepositLedgerListResponse> GetAdminDepositLedgers(
        Guid propertyId,
        string? depositType,
        bool unmaskPii = false);
}
