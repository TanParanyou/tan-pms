using TanPms.Domain.Common;
using TanPms.Domain.Enums;
using TanPms.Domain.Exceptions;
using TanPms.Domain.Services;

namespace TanPms.Domain.Entities;

public sealed class Property : AuditableEntity
{
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string TaxBranchCode { get; set; }
    public string Address { get; set; } = string.Empty;
    public List<Building> Buildings { get; init; } = [];
    public List<UnitType> UnitTypes { get; init; } = [];
}

public sealed class Building : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public List<Floor> Floors { get; init; } = [];
}

public sealed class Floor : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid BuildingId { get; set; }
    public required int FloorNumber { get; set; }
    public required string Name { get; set; }
    public List<Unit> Units { get; init; } = [];
}

public sealed class UnitType : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public decimal AreaSqm { get; set; }
    public int TotalQuotaUnits { get; set; }
    public decimal HourlyBasePackagePrice { get; set; }
    public int HourlyBasePackageHours { get; set; } = 3;
    public decimal HourlyAdditionalHourPrice { get; set; }
    public int HourlyGracePeriodMinutes { get; set; } = 15;
    public int TurnaroundBufferMinutes { get; set; } = 30;
    public decimal DailyRate { get; set; }
    public decimal MonthlyRentRate { get; set; }
}

public sealed class Unit : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid BuildingId { get; set; }
    public required Guid FloorId { get; set; }
    public required Guid UnitTypeId { get; set; }
    public required string UnitNumber { get; set; }
    public OccupancyStatus OccupancyStatus { get; private set; } = OccupancyStatus.Vacant;
    public ConditionStatus ConditionStatus { get; private set; } = ConditionStatus.Clean;
    public List<StayMode> SupportedStayModes { get; init; } = [StayMode.Hourly, StayMode.Daily, StayMode.Monthly];

    public void EnsureCanCheckIn(bool overrideDirtyCheckIn, bool hasOverridePermission, string? overrideReason)
    {
        if (ConditionStatus == ConditionStatus.Clean)
        {
            return;
        }

        if (!overrideDirtyCheckIn)
        {
            throw new DomainRuleException(
                DomainErrorCodes.UnitNotClean,
                $"Unit {UnitNumber} is currently in {ConditionStatus} status and cannot be checked in without override permission.");
        }

        if (!hasOverridePermission)
        {
            throw new DomainRuleException(
                DomainErrorCodes.PermissionDenied,
                "Caller does not hold permission 'admin.stay.override_dirty_checkin'.",
                httpStatus: 403);
        }

        if (string.IsNullOrWhiteSpace(overrideReason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "An audit reason is required when overriding a dirty unit check-in.",
                httpStatus: 400);
        }
    }

    public void MarkOccupied()
    {
        if (OccupancyStatus == OccupancyStatus.Blocked)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Unit {UnitNumber} is blocked and cannot be occupied.");
        }

        OccupancyStatus = OccupancyStatus.Occupied;
    }

    public void MarkReserved()
    {
        OccupancyStatus = OccupancyStatus.Reserved;
    }

    public void MarkBlocked()
    {
        OccupancyStatus = OccupancyStatus.Blocked;
        ConditionStatus = ConditionStatus.OutOfOrder;
    }

    public HousekeepingTask MarkCheckedOutOrMovedOut(string documentNumber)
    {
        OccupancyStatus = OccupancyStatus.Vacant;
        ConditionStatus = ConditionStatus.Dirty;
        return new HousekeepingTask
        {
            PropertyId = PropertyId,
            UnitId = Id,
            SourceDocumentNumber = documentNumber,
            Status = HousekeepingTaskStatus.Pending
        };
    }

    public void SetConditionStatus(ConditionStatus nextStatus)
    {
        ConditionStatus = nextStatus;
    }
}

public sealed class Customer : AuditableEntity
{
    public required string FullName { get; set; }
    public required string NationalIdOrPassport { get; set; }
    public bool IsPassport { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool IsCorporate { get; set; }
    public string? TaxId { get; set; }

    public string GetMaskedIdentity() => PiiMasker.MaskIdentity(NationalIdOrPassport, IsPassport);
}

public sealed class Occupant : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? StayId { get; set; }
    public Guid? LeaseId { get; set; }
    public required string FullName { get; set; }
    public required string NationalityCode { get; set; }
    public required string IdentityNumber { get; set; }
    public bool IsPrimaryOccupant { get; set; }
    public string? VehicleLicensePlate { get; set; }
}

public sealed class Reservation : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid CustomerId { get; set; }
    public required Guid UnitTypeId { get; set; }
    public Guid? UnitId { get; set; }
    public required StayMode StayMode { get; set; }
    public required DateTimeOffset SlotStartAt { get; set; }
    public required DateTimeOffset SlotEndAt { get; set; }
    public DateTimeOffset HoldExpiresAt { get; set; }
    public decimal DepositAmount { get; set; }
    public string? PaymentSlipFileKey { get; set; }
    public ReservationStatus Status { get; private set; } = ReservationStatus.Hold;

    public static Reservation CreateOnlineHold(
        Guid propertyId,
        string documentNumber,
        Guid customerId,
        Guid unitTypeId,
        StayMode stayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt,
        decimal depositAmount,
        DateTimeOffset nowUtc,
        int holdTtlMinutes = 15,
        Guid? unitId = null)
    {
        return new Reservation
        {
            PropertyId = propertyId,
            DocumentNumber = documentNumber,
            CustomerId = customerId,
            UnitTypeId = unitTypeId,
            UnitId = unitId,
            StayMode = stayMode,
            SlotStartAt = slotStartAt,
            SlotEndAt = slotEndAt,
            DepositAmount = depositAmount,
            HoldExpiresAt = nowUtc.AddMinutes(holdTtlMinutes),
            Status = ReservationStatus.Hold
        };
    }

    public bool IsHoldExpired(DateTimeOffset nowUtc) =>
        Status == ReservationStatus.Hold && nowUtc > HoldExpiresAt;

    public void SubmitPaymentSlip(string slipFileKey, DateTimeOffset nowUtc)
    {
        if (IsHoldExpired(nowUtc) || Status == ReservationStatus.Expired)
        {
            Status = ReservationStatus.Expired;
            throw new DomainRuleException(
                DomainErrorCodes.ReservationHoldExpired,
                $"Reservation {DocumentNumber} hold expired at {HoldExpiresAt:O}.");
        }

        PaymentSlipFileKey = slipFileKey;
        Status = ReservationStatus.PendingVerification;
    }

    public void ExpireHoldIfPastDue(DateTimeOffset nowUtc)
    {
        if (IsHoldExpired(nowUtc))
        {
            Status = ReservationStatus.Expired;
        }
    }

    public void ConfirmByAdmin()
    {
        if (Status is not (ReservationStatus.PendingVerification or ReservationStatus.Hold))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Reservation {DocumentNumber} cannot be confirmed from status {Status}.",
                httpStatus: 400);
        }

        Status = ReservationStatus.Confirmed;
    }

    public void MarkCheckedIn(Guid assignedUnitId)
    {
        UnitId = assignedUnitId;
        Status = ReservationStatus.CheckedIn;
    }
}

public sealed class Stay : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? ReservationId { get; set; }
    public required StayMode StayMode { get; set; }
    public required DateTimeOffset CheckInAt { get; set; }
    public DateTimeOffset? ExpectedCheckOutAt { get; set; }
    public DateTimeOffset? CheckOutAt { get; private set; }
    public decimal KeyDepositAmount { get; set; }
    public StayStatus Status { get; private set; } = StayStatus.Active;

    public void CompleteCheckOut(Folio folio, DepositLedger? keyDepositLedger, DateTimeOffset checkOutAt)
    {
        if (folio.BalanceDue != 0.00m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.StayFolioUnsettled,
                $"Stay {DocumentNumber} cannot be checked out while Folio balance due is {folio.BalanceDue:0.00}.");
        }

        if (KeyDepositAmount > 0m && (keyDepositLedger is null || keyDepositLedger.CurrentBalance != 0.00m))
        {
            throw new DomainRuleException(
                DomainErrorCodes.StayFolioUnsettled,
                $"Stay {DocumentNumber} cannot be checked out while key deposit balance is unsettled.");
        }

        CheckOutAt = checkOutAt;
        Status = StayStatus.CheckedOut;
    }
}

public sealed class FolioLine
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Description { get; init; }
    public required decimal Amount { get; init; }
    public required TaxMode TaxMode { get; init; }
}

public sealed class Folio : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid StayId { get; set; }
    public List<FolioLine> Charges { get; init; } = [];
    public decimal TotalCharges => Charges.Sum(c => c.Amount);
    public decimal TotalPayments { get; private set; }
    public decimal BalanceDue => TotalCharges - TotalPayments;

    public void AddCharge(string description, decimal amount, TaxMode taxMode = TaxMode.VatIncluded)
    {
        Charges.Add(new FolioLine
        {
            Description = description,
            Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero),
            TaxMode = taxMode
        });
    }

    public void RecordPayment(decimal amount)
    {
        TotalPayments += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }
}

public sealed class Lease : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public required Guid CustomerId { get; set; }
    public required DateOnly StartDate { get; set; }
    public required DateOnly EndDate { get; set; }
    public required decimal MonthlyRentAmount { get; set; }
    public required decimal SecurityDepositAmount { get; set; }
    public decimal InitialWaterMeterReading { get; set; }
    public decimal InitialElectricMeterReading { get; set; }
    public LeaseStatus Status { get; private set; } = LeaseStatus.Draft;

    public bool BlocksUnitAvailability => Status is LeaseStatus.Active or LeaseStatus.MoveOutNotice;

    public void Activate()
    {
        Status = LeaseStatus.Active;
    }

    public void GiveMoveOutNotice()
    {
        if (Status != LeaseStatus.Active)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Only an Active lease can transition to MoveOutNotice.",
                httpStatus: 400);
        }

        Status = LeaseStatus.MoveOutNotice;
    }

    public void CompleteMoveOut()
    {
        Status = LeaseStatus.MovedOut;
    }
}

public sealed class MeterReading : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid UnitId { get; set; }
    public required UtilityType UtilityType { get; set; }
    public required string BillingPeriodYearMonth { get; set; }
    public required decimal PreviousReading { get; set; }
    public required decimal CurrentReading { get; set; }
    public required decimal UsageUnits { get; set; }
    public required decimal ChargeAmount { get; set; }
    public bool IsRolloverConfirmed { get; set; }
    public string? PhotoFileKey { get; set; }
}

public sealed class InvoiceLine
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Description { get; init; }
    public required TaxMode TaxMode { get; init; }
    public required decimal LineAmount { get; init; }
    public required decimal VatRate { get; init; }
    public required decimal SubTotal { get; init; }
    public required decimal VatAmount { get; init; }
    public required decimal NetAmount { get; init; }
}

public sealed class Invoice : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? StayId { get; set; }
    public Guid? LeaseId { get; set; }
    public List<InvoiceLine> Lines { get; init; } = [];
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public string? VoidReason { get; private set; }

    public decimal SubTotal => Lines.Sum(l => l.SubTotal);
    public decimal TotalVatAmount => Lines.Sum(l => l.VatAmount);
    public decimal TotalAmount => Lines.Sum(l => l.NetAmount);

    public void AddLine(string description, decimal lineAmount, TaxMode taxMode)
    {
        EnsureMutable();
        var breakdown = ThaiTaxCalculator.CalculateLine(lineAmount, taxMode);
        Lines.Add(new InvoiceLine
        {
            Description = description,
            TaxMode = taxMode,
            LineAmount = breakdown.LineAmount,
            VatRate = breakdown.VatRate,
            SubTotal = breakdown.SubTotal,
            VatAmount = breakdown.VatAmount,
            NetAmount = breakdown.TotalAmount
        });
    }

    public void Issue()
    {
        EnsureMutable();
        Status = InvoiceStatus.Issued;
    }

    public void MarkPaid()
    {
        if (Status == InvoiceStatus.Voided)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Voided invoice {DocumentNumber} cannot be paid.");
        }

        Status = InvoiceStatus.Paid;
    }

    public void EnsureCanDelete()
    {
        if (Status != InvoiceStatus.Draft)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {DocumentNumber} in status {Status} cannot be deleted. Use Void instead.");
        }
    }

    public AuditEvent Void(string reason)
    {
        if (Status == InvoiceStatus.Draft)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                "Draft invoice should be deleted rather than voided.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Void reason is required for audit logging.",
                httpStatus: 400);
        }

        var previousStatus = Status;
        Status = InvoiceStatus.Voided;
        VoidReason = reason;

        return new AuditEvent
        {
            PropertyId = PropertyId,
            ActionKey = "admin.invoice.void",
            EntityId = Id,
            Reason = reason,
            BeforeStateJson = $"{{\"status\":\"{previousStatus}\"}}",
            AfterStateJson = "{\"status\":\"Voided\"}"
        };
    }

    private void EnsureMutable()
    {
        if (Status != InvoiceStatus.Draft)
        {
            throw new DomainRuleException(
                DomainErrorCodes.InvoiceImmutableStatus,
                $"Invoice {DocumentNumber} is already in status {Status} and cannot be modified.");
        }
    }
}

public sealed class Receipt : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid InvoiceId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? CashierShiftId { get; set; }
    public required decimal InvoiceTotalAmount { get; set; }
    public decimal WithholdingTaxAmount { get; set; }
    public string? WhtCertificateNumber { get; set; }
    public required decimal NetPayableAmount { get; set; }
    public bool IsCashPayment { get; set; }
}

public sealed class CashierShift : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required string CashierUserId { get; set; }
    public required decimal OpeningFloatCash { get; set; }
    public decimal CashReceiptsInShift { get; private set; }
    public decimal CashDepositsReceivedInShift { get; private set; }
    public decimal CashDepositsRefundedInShift { get; private set; }
    public decimal? ActualCashCounted { get; private set; }
    public decimal? ExpectedDrawerCash { get; private set; }
    public decimal? CashVariance { get; private set; }
    public string? VarianceRemark { get; private set; }
    public CashierShiftStatus Status { get; private set; } = CashierShiftStatus.Open;

    public void EnsureOpen()
    {
        if (Status != CashierShiftStatus.Open)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ShiftNotOpen,
                $"CashierShift {DocumentNumber} is {Status}; an Open shift is required.");
        }
    }

    public void RecordCashReceipt(decimal amount)
    {
        EnsureOpen();
        CashReceiptsInShift += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    public void RecordCashDepositReceived(decimal amount)
    {
        EnsureOpen();
        CashDepositsReceivedInShift += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    public void RecordCashDepositRefunded(decimal amount)
    {
        EnsureOpen();
        CashDepositsRefundedInShift += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    public void CloseShift(decimal actualCashCounted, string? varianceRemark = null)
    {
        EnsureOpen();
        var reconciliation = CashierShiftReconciler.Reconcile(
            this,
            actualCashCounted,
            varianceRemark);

        ActualCashCounted = reconciliation.ActualCashCounted;
        ExpectedDrawerCash = reconciliation.ExpectedDrawerCash;
        CashVariance = reconciliation.CashVariance;
        VarianceRemark = varianceRemark;
        Status = CashierShiftStatus.Closed;
    }

    public void MarkReconciled()
    {
        if (Status != CashierShiftStatus.Closed)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "CashierShift must be Closed before it can be marked Reconciled.",
                httpStatus: 400);
        }

        Status = CashierShiftStatus.Reconciled;
    }
}

public sealed class DepositTransaction : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid DepositLedgerId { get; set; }
    public required string DocumentNumber { get; set; }
    public required DepositTransactionType TransactionType { get; set; }
    public required decimal Amount { get; set; }
    public string? Reason { get; set; }
}

public sealed class DepositLedger : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? StayId { get; set; }
    public Guid? LeaseId { get; set; }
    public Guid? ReservationId { get; set; }
    public required DepositType DepositType { get; set; }
    public List<DepositTransaction> Transactions { get; init; } = [];

    public decimal CurrentBalance =>
        Transactions.Where(t => t.TransactionType == DepositTransactionType.Received).Sum(t => t.Amount)
        - Transactions.Where(t => t.TransactionType != DepositTransactionType.Received).Sum(t => t.Amount);

    public DepositTransaction RecordReceipt(string documentNumber, decimal amount, CashierShift? cashShift = null)
    {
        cashShift?.RecordCashDepositReceived(amount);
        var tx = new DepositTransaction
        {
            PropertyId = PropertyId,
            DepositLedgerId = Id,
            DocumentNumber = documentNumber,
            TransactionType = DepositTransactionType.Received,
            Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero)
        };
        Transactions.Add(tx);
        return tx;
    }

    public DepositTransaction RecordDeduction(string documentNumber, decimal amount, string reason)
    {
        var rounded = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        if (rounded > CurrentBalance)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Deduction amount cannot exceed current deposit balance.",
                httpStatus: 400);
        }

        var tx = new DepositTransaction
        {
            PropertyId = PropertyId,
            DepositLedgerId = Id,
            DocumentNumber = documentNumber,
            TransactionType = DepositTransactionType.DeductedForDamageOrUtility,
            Amount = rounded,
            Reason = reason
        };
        Transactions.Add(tx);
        return tx;
    }

    public DepositTransaction RefundRemainingBalance(string documentNumber, string reason, CashierShift? cashShift = null)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Reason is required when refunding deposit balance.",
                httpStatus: 400);
        }

        var refundable = CurrentBalance;
        cashShift?.RecordCashDepositRefunded(refundable);
        var tx = new DepositTransaction
        {
            PropertyId = PropertyId,
            DepositLedgerId = Id,
            DocumentNumber = documentNumber,
            TransactionType = DepositTransactionType.Refunded,
            Amount = refundable,
            Reason = reason
        };
        Transactions.Add(tx);
        return tx;
    }
}

public sealed class HousekeepingTask : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid UnitId { get; set; }
    public required string SourceDocumentNumber { get; set; }
    public string? AssignedStaffUserId { get; set; }
    public HousekeepingTaskStatus Status { get; set; } = HousekeepingTaskStatus.Pending;

    public void AdvanceUnitCondition(Unit unit)
    {
        switch (Status)
        {
            case HousekeepingTaskStatus.Pending:
                Status = HousekeepingTaskStatus.Cleaning;
                unit.SetConditionStatus(ConditionStatus.Cleaning);
                break;
            case HousekeepingTaskStatus.Cleaning:
                Status = HousekeepingTaskStatus.Inspecting;
                unit.SetConditionStatus(ConditionStatus.Inspecting);
                break;
            case HousekeepingTaskStatus.Inspecting:
                Status = HousekeepingTaskStatus.Completed;
                unit.SetConditionStatus(ConditionStatus.Clean);
                break;
        }
    }
}

public sealed class WorkOrder : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public Guid? ReportedByCustomerId { get; set; }
    public required string IssueSummary { get; set; }
    public string? BeforePhotoFileKey { get; set; }
    public string? AfterPhotoFileKey { get; set; }
    public decimal TenantChargeAmount { get; set; }
    public WorkOrderStatus Status { get; set; } = WorkOrderStatus.Open;
}

public sealed class Parcel : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public required Guid CustomerId { get; set; }
    public required string CarrierName { get; set; }
    public string? TrackingNumber { get; set; }
    public string? ParcelPhotoFileKey { get; set; }
    public DateTimeOffset ArrivedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PickedUpAt { get; private set; }
    public ParcelStatus Status { get; private set; } = ParcelStatus.Arrived;

    public void MarkPickedUp(DateTimeOffset pickedUpAt)
    {
        PickedUpAt = pickedUpAt;
        Status = ParcelStatus.PickedUp;
    }
}
