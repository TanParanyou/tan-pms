using TanPms.Application.Common.Models;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Cashier;

public interface IDepositLedgerStore
{
    Result<DepositLedgerListResponse> GetAdminDepositLedgers(
        Guid propertyId,
        string? depositType,
        bool unmaskPii = false,
        PageRequest? paging = null);

    Result<DepositLedgerItemDto> GetAdminDepositLedger(Guid propertyId, Guid ledgerId, bool unmaskPii = false);
}
