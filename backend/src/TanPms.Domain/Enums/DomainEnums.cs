namespace TanPms.Domain.Enums;

public enum StayMode
{
    Hourly = 1,
    Daily = 2,
    Monthly = 3
}

public enum OccupancyStatus
{
    Vacant = 1,
    Occupied = 2,
    Reserved = 3,
    Blocked = 4
}

public enum ConditionStatus
{
    Clean = 1,
    Dirty = 2,
    Cleaning = 3,
    Inspecting = 4,
    OutOfOrder = 5
}

public enum ReservationStatus
{
    Hold = 1,
    PendingVerification = 2,
    Confirmed = 3,
    CheckedIn = 4,
    Expired = 5,
    Cancelled = 6,
    NoShow = 7
}

public enum StayStatus
{
    Active = 1,
    CheckedOut = 2,
    Cancelled = 3
}

public enum LeaseStatus
{
    Draft = 1,
    PendingSignature = 2,
    Active = 3,
    MoveOutNotice = 4,
    MovedOut = 5,
    Terminated = 6,
    Cancelled = 7
}

public enum UtilityType
{
    Water = 1,
    Electric = 2
}

public enum UtilityBillingMode
{
    PerUnit = 1,
    MinimumUnits = 2,
    FlatRate = 3
}

public enum TaxMode
{
    Exempt = 1,
    VatIncluded = 2,
    VatExcluded = 3
}

public enum InvoiceStatus
{
    Draft = 1,
    Issued = 2,
    PartiallyPaid = 3,
    Paid = 4,
    Overdue = 5,
    Voided = 6
}

public enum CashierShiftStatus
{
    Open = 1,
    Closed = 2,
    Reconciled = 3
}

public enum DepositType
{
    KeyDeposit = 1,
    ReservationDeposit = 2,
    LeaseSecurityDeposit = 3
}

public enum DepositTransactionType
{
    Received = 1,
    DeductedForDamageOrUtility = 2,
    Refunded = 3,
    Forfeited = 4
}

public enum HousekeepingTaskStatus
{
    Pending = 1,
    Cleaning = 2,
    Inspecting = 3,
    Completed = 4
}

public enum WorkOrderStatus
{
    Open = 1,
    InProgress = 2,
    Completed = 3,
    Cancelled = 4
}

public enum ParcelStatus
{
    Arrived = 1,
    PickedUp = 2
}

public enum DocumentTypeCode
{
    RES = 1,
    STY = 2,
    LSE = 3,
    INV = 4,
    RCT = 5,
    DEP = 6,
    SHF = 7,
    WKO = 8,
    PCL = 9
}
