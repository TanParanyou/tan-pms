namespace TanPms.Domain.Identity;

public static class PermissionKeys
{
    public const string AdminUsersRead = "admin.users.read";
    public const string AdminUsersManage = "admin.users.manage";
    public const string AdminPropertiesRead = "admin.properties.read";
    public const string AdminPropertiesManage = "admin.properties.manage";
    public const string AdminRatesManage = "admin.rates.manage";
    public const string AdminReservationsRead = "admin.reservations.read";
    public const string AdminReservationsManage = "admin.reservations.manage";
    public const string AdminStayCheckIn = "admin.stay.checkin";
    public const string AdminStayCheckOut = "admin.stay.checkout";
    public const string AdminStayOverrideDirtyCheckIn = "admin.stay.override_dirty_checkin";
    public const string AdminCustomerUnmaskPii = "admin.customer.unmask_pii";
    public const string AdminRegulatoryExport = "admin.regulatory.export";
    public const string AdminLeasesManage = "admin.leases.manage";
    public const string AdminLeasesSettleMoveOut = "admin.leases.settle_moveout";
    public const string AdminMetersRecord = "admin.meters.record";
    public const string AdminMetersOverrideLocked = "admin.meters.override_locked";
    public const string AdminBillingIssueBatch = "admin.billing.issue_batch";
    public const string AdminCashierOperateShift = "admin.cashier.operate_shift";
    public const string AdminCashierReconcileShift = "admin.cashier.reconcile_shift";
    public const string AdminPaymentsVerifySlip = "admin.payments.verify_slip";
    public const string AdminInvoicesVoid = "admin.invoices.void";
    public const string AdminHousekeepingUpdate = "admin.housekeeping.update";
    public const string AdminWorkOrdersManage = "admin.workorders.manage";
    public const string AdminParcelsManage = "admin.parcels.manage";
    public const string AdminAnalyticsRead = "admin.analytics.read";

    public static readonly IReadOnlyList<string> All =
    [
        AdminUsersRead,
        AdminUsersManage,
        AdminPropertiesRead,
        AdminPropertiesManage,
        AdminRatesManage,
        AdminReservationsRead,
        AdminReservationsManage,
        AdminStayCheckIn,
        AdminStayCheckOut,
        AdminStayOverrideDirtyCheckIn,
        AdminCustomerUnmaskPii,
        AdminRegulatoryExport,
        AdminLeasesManage,
        AdminLeasesSettleMoveOut,
        AdminMetersRecord,
        AdminMetersOverrideLocked,
        AdminBillingIssueBatch,
        AdminCashierOperateShift,
        AdminCashierReconcileShift,
        AdminPaymentsVerifySlip,
        AdminInvoicesVoid,
        AdminHousekeepingUpdate,
        AdminWorkOrdersManage,
        AdminParcelsManage,
        AdminAnalyticsRead
    ];
}
