using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public static class ReceiptRules
{
    // Receipts are read by whoever verifies slips, runs the cash drawer or bills tenants.
    public static readonly string[] AdminReadPermissions =
    [
        PermissionKeys.AdminPaymentsVerifySlip,
        PermissionKeys.AdminCashierOperateShift,
        PermissionKeys.AdminCashierReconcileShift,
        PermissionKeys.AdminBillingIssueBatch
    ];

    public static Error NotFound(Guid receiptId) =>
        new(DomainErrorCodes.ValidationFailed, $"Receipt '{receiptId}' was not found.");

    public static Error ClientNotFound() =>
        new(DomainErrorCodes.PermissionDenied, "Receipt was not found for the current customer.");
}
