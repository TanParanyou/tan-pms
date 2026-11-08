using TanPms.Application.Common.Contracts;
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

    Result<CashierShiftDto> GetAdminCashierShift(Guid propertyId, Guid shiftId);

    // requiredOwnerUserId: null lets a supervisor act on any cashier's shift.
    Result<CashierShiftDto> CancelAdminCashierShift(
        Guid propertyId,
        Guid shiftId,
        string? requiredOwnerUserId,
        ReasonRequest request);

    Result<CashierShiftDto> UpdateAdminCashierShiftRemark(
        Guid propertyId,
        Guid shiftId,
        string? requiredOwnerUserId,
        UpdateCashierShiftRemarkRequest request);

    bool HasOpenCashierShift(string cashierUserId, IReadOnlySet<Guid> propertyIds);
}
