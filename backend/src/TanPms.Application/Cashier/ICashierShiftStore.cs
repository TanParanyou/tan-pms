using TanPms.Application.Common.Results;

namespace TanPms.Application.Cashier;

public interface ICashierShiftStore
{
    Result<CashierShiftDto> OpenAdminCashierShift(
        Guid propertyId,
        string cashierUserId,
        OpenCashierShiftRequest request,
        DateTimeOffset? nowUtc = null);

    Result<CurrentCashierShiftResponse> GetCurrentAdminCashierShift(Guid propertyId, string cashierUserId);

    Result<CashierShiftListResponse> GetAdminCashierShifts(Guid propertyId, string? status);

    Result<CashierShiftDto> CloseAdminCashierShift(
        Guid propertyId,
        Guid shiftId,
        string cashierUserId,
        CloseCashierShiftRequest request);

    Result<CashierShiftDto> ReconcileAdminCashierShift(Guid propertyId, Guid shiftId);

    bool HasOpenCashierShift(string cashierUserId, IReadOnlySet<Guid> propertyIds);
}
