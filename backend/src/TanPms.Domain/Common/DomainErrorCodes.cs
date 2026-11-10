namespace TanPms.Domain.Common;

public static class DomainErrorCodes
{
    public const string ValidationFailed = "validation.failed";
    public const string LocalizedTextThaiRequired = "localized_text.thai_required";
    public const string LocalizedTextTooLong = "localized_text.too_long";
    public const string Unauthenticated = "auth.unauthenticated";
    public const string InvalidCredentials = "auth.invalid_credentials";
    public const string PropertyScopeDenied = "auth.property_scope_denied";
    public const string PermissionDenied = "auth.permission_denied";
    public const string UnitNotClean = "unit.not_clean";
    public const string ReservationSlotOverlap = "reservation.slot_overlap";
    public const string ReservationQuotaExhausted = "reservation.quota_exhausted";
    public const string ReservationHoldExpired = "reservation.hold_expired";
    public const string StayFolioUnsettled = "stay.folio_unsettled";
    public const string InvoiceImmutableStatus = "invoice.immutable_status";
    public const string ShiftNotOpen = "shift.not_open";
    public const string MeterRolloverUnconfirmed = "meter.rollover_unconfirmed";
    public const string MasterDataInUse = "master_data.in_use";
}
