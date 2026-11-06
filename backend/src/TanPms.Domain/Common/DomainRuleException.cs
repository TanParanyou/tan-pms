namespace TanPms.Domain.Common;

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
