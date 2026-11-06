namespace TanPms.Domain.Exceptions;

public static class DomainErrorCodes
{
    public const string ValidationFailed = "validation.failed";
    public const string Unauthenticated = "auth.unauthenticated";
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
}

public sealed class DomainRuleException : Exception
{
    public string ErrorCode { get; }
    public string Title { get; }
    public int HttpStatus { get; }

    public DomainRuleException(
        string errorCode,
        string message,
        int httpStatus = 409,
        string? title = null)
        : base(message)
    {
        ErrorCode = errorCode;
        HttpStatus = httpStatus;
        Title = title ?? ResolveDefaultTitle(errorCode);
    }

    private static string ResolveDefaultTitle(string errorCode) => errorCode switch
    {
        DomainErrorCodes.ValidationFailed => "Validation failed",
        DomainErrorCodes.Unauthenticated => "Authentication required",
        DomainErrorCodes.PropertyScopeDenied => "Property scope access denied",
        DomainErrorCodes.PermissionDenied => "Permission denied for requested action",
        DomainErrorCodes.UnitNotClean => "Unit condition is not clean for check-in",
        DomainErrorCodes.ReservationSlotOverlap => "Requested stay slot overlaps with an existing allocation",
        DomainErrorCodes.ReservationQuotaExhausted => "UnitType quota is exhausted for the requested period",
        DomainErrorCodes.ReservationHoldExpired => "Reservation hold period has expired",
        DomainErrorCodes.StayFolioUnsettled => "Stay folio or deposit ledger is not settled for check-out",
        DomainErrorCodes.InvoiceImmutableStatus => "Issued or settled invoice cannot be modified or deleted",
        DomainErrorCodes.ShiftNotOpen => "An open cashier shift is required for cash operations",
        DomainErrorCodes.MeterRolloverUnconfirmed => "Meter rollover must be explicitly confirmed when current reading is lower than previous reading",
        _ => "Domain rule violation"
    };
}
