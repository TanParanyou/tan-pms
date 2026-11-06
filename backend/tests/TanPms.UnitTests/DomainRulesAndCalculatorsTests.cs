using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Rates;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;
using Xunit;

namespace TanPms.UnitTests;

public sealed class DomainRulesAndCalculatorsTests
{
    private static readonly HourlyRateRule DefaultHourlyRule = new(
        BasePackageHours: 3,
        BasePackagePrice: 350.00m,
        AdditionalHourPrice: 100.00m,
        GracePeriodMinutes: 15,
        AutoCapToDailyRate: 890.00m,
        TurnaroundBufferMinutes: 30);

    [Theory]
    [InlineData(120, 0, 350.00, 350.00, false)]
    [InlineData(180, 0, 350.00, 350.00, false)]
    [InlineData(195, 0, 350.00, 350.00, false)]
    [InlineData(196, 1, 450.00, 450.00, false)]
    [InlineData(255, 1, 450.00, 450.00, false)]
    [InlineData(256, 2, 550.00, 550.00, false)]
    [InlineData(600, 7, 1050.00, 890.00, true)]
    public void HourlyPricingCalculator_Should_Compute_Package_GracePeriod_ExtraHours_And_DailyCap(
        int durationMinutes,
        int expectedExtraHours,
        decimal expectedRawCharge,
        decimal expectedFinalCharge,
        bool expectedCapped)
    {
        var result = HourlyPricingCalculator.Calculate(durationMinutes, DefaultHourlyRule);

        Assert.Equal(expectedExtraHours, result.ExtraHours);
        Assert.Equal(expectedRawCharge, result.RawCharge);
        Assert.Equal(expectedFinalCharge, result.FinalHourlyRoomCharge);
        Assert.Equal(expectedCapped, result.IsCappedToDailyRate);
    }

    [Fact]
    public void HourlyPricingCalculator_Should_Add_TurnaroundBufferMinutes_To_BlockedSlot()
    {
        var checkOutAt = new DateTimeOffset(2026, 11, 6, 14, 0, 0, TimeSpan.FromHours(7));
        var blockedUntil = HourlyPricingCalculator.GetTurnaroundBlockedUntil(checkOutAt, 30);

        Assert.Equal(new DateTimeOffset(2026, 11, 6, 14, 30, 0, TimeSpan.FromHours(7)), blockedUntil);
    }

    [Fact]
    public void UtilityMeterCalculator_Should_Throw_RolloverUnconfirmed_When_Current_Lower_Than_Previous()
    {
        var tariff = new UtilityTariff(UtilityBillingMode.PerUnit, RatePerUnit: 8.00m, MinimumChargeAmount: 100.00m);

        var ex = Assert.Throws<DomainRuleException>(() =>
            UtilityMeterCalculator.Calculate(
                previousReading: 9950m,
                currentReading: 120m,
                tariff: tariff,
                isRolloverConfirmed: false,
                meterMaxDigits: 4));

        Assert.Equal(DomainErrorCodes.MeterRolloverUnconfirmed, ex.ErrorCode);
        Assert.Equal(409, ex.HttpStatus);
    }

    [Fact]
    public void UtilityMeterCalculator_Should_Calculate_Rollover_And_All_Three_BillingModes()
    {
        var perUnitTariff = new UtilityTariff(
            UtilityBillingMode.PerUnit,
            RatePerUnit: 8.00m,
            MinimumChargeAmount: 100.00m);

        var rolloverResult = UtilityMeterCalculator.Calculate(
            previousReading: 9950m,
            currentReading: 120m,
            tariff: perUnitTariff,
            isRolloverConfirmed: true,
            meterMaxDigits: 4);

        Assert.True(rolloverResult.UsedRollover);
        Assert.Equal(170.00m, rolloverResult.UsageUnits);
        Assert.Equal(1360.00m, rolloverResult.ChargeAmount);

        var minUnitsTariff = new UtilityTariff(
            UtilityBillingMode.MinimumUnits,
            RatePerUnit: 18.00m,
            IncludedUnits: 10m,
            BaseMinimumAmount: 150.00m);

        var withinMin = UtilityMeterCalculator.Calculate(100m, 108m, minUnitsTariff);
        Assert.Equal(8.00m, withinMin.UsageUnits);
        Assert.Equal(150.00m, withinMin.ChargeAmount);

        var aboveMin = UtilityMeterCalculator.Calculate(100m, 115m, minUnitsTariff);
        Assert.Equal(15.00m, aboveMin.UsageUnits);
        Assert.Equal(240.00m, aboveMin.ChargeAmount);

        var flatPerOccupantTariff = new UtilityTariff(
            UtilityBillingMode.FlatRate,
            RatePerUnit: 0m,
            FlatRateAmount: 120.00m,
            FlatRatePerOccupant: true);

        var flatResult = UtilityMeterCalculator.Calculate(50m, 62m, flatPerOccupantTariff, occupantCount: 2);
        Assert.Equal(240.00m, flatResult.ChargeAmount);
    }

    [Fact]
    public void ThaiTaxCalculator_Should_Calculate_Exempt_VatIncluded_VatExcluded_And_WithholdingTax()
    {
        var exempt = ThaiTaxCalculator.CalculateLine(8500.00m, TaxMode.Exempt);
        Assert.Equal(8500.00m, exempt.SubTotal);
        Assert.Equal(0.00m, exempt.VatAmount);
        Assert.Equal(8500.00m, exempt.TotalAmount);

        var vatIncluded = ThaiTaxCalculator.CalculateLine(1070.00m, TaxMode.VatIncluded);
        Assert.Equal(1000.00m, vatIncluded.SubTotal);
        Assert.Equal(70.00m, vatIncluded.VatAmount);
        Assert.Equal(1070.00m, vatIncluded.TotalAmount);

        var vatExcluded = ThaiTaxCalculator.CalculateLine(1000.00m, TaxMode.VatExcluded);
        Assert.Equal(1000.00m, vatExcluded.SubTotal);
        Assert.Equal(70.00m, vatExcluded.VatAmount);
        Assert.Equal(1070.00m, vatExcluded.TotalAmount);

        var wht = ThaiTaxCalculator.CalculateWithholdingTax(subTotal: 1000.00m, invoiceTotal: 1070.00m, whtRate: 0.05m);
        Assert.Equal(50.00m, wht.WithholdingTaxAmount);
        Assert.Equal(1020.00m, wht.NetPayable);
    }

    [Fact]
    public void CashierShiftReconciler_Should_Enforce_OpenShift_And_Calculate_ExpectedCash_And_Variance()
    {
        var shift = new CashierShift
        {
            PropertyId = Guid.CreateVersion7(),
            DocumentNumber = "BKK01-SHF-2611-0001",
            CashierUserId = "cashier-01",
            OpeningFloatCash = 2000.00m
        };

        shift.RecordCashReceipt(1250.00m);
        shift.RecordCashDepositReceived(500.00m);
        shift.RecordCashDepositRefunded(300.00m);

        var missingRemarkEx = Assert.Throws<DomainRuleException>(() =>
            shift.CloseShift(actualCashCounted: 3400.00m, varianceRemark: null));
        Assert.Equal(DomainErrorCodes.ValidationFailed, missingRemarkEx.ErrorCode);

        shift.CloseShift(actualCashCounted: 3400.00m, varianceRemark: "Short 50 THB due to coin change");
        Assert.Equal(CashierShiftStatus.Closed, shift.Status);
        Assert.Equal(3450.00m, shift.ExpectedDrawerCash);
        Assert.Equal(-50.00m, shift.CashVariance);

        var closedEx = Assert.Throws<DomainRuleException>(() => shift.RecordCashReceipt(100.00m));
        Assert.Equal(DomainErrorCodes.ShiftNotOpen, closedEx.ErrorCode);
    }

    [Fact]
    public void PiiMasker_Should_Mask_ThaiNationalId_And_Passport()
    {
        Assert.Equal("1-xxxx-xxxxx-12-3", PiiMasker.MaskThaiNationalId("1100501234123"));
        Assert.Equal("1-xxxx-xxxxx-12-3", PiiMasker.MaskThaiNationalId("1-1005-01234-12-3"));
        Assert.Equal("AAxxxx567", PiiMasker.MaskPassport("AA1234567"));
    }

    [Theory]
    [InlineData(DocumentTypeCode.RES, "BKK01-RES-2611-0001")]
    [InlineData(DocumentTypeCode.STY, "BKK01-STY-2611-0001")]
    [InlineData(DocumentTypeCode.LSE, "BKK01-LSE-2611-0001")]
    [InlineData(DocumentTypeCode.INV, "BKK01-INV-2611-0001")]
    [InlineData(DocumentTypeCode.RCT, "BKK01-RCT-2611-0001")]
    [InlineData(DocumentTypeCode.DEP, "BKK01-DEP-2611-0001")]
    [InlineData(DocumentTypeCode.SHF, "BKK01-SHF-2611-0001")]
    [InlineData(DocumentTypeCode.WKO, "BKK01-WKO-2611-0001")]
    [InlineData(DocumentTypeCode.PCL, "BKK01-PCL-2611-0001")]
    public void DocumentNumberFormatter_Should_Format_All_9_Document_Categories(
        DocumentTypeCode docType,
        string expected)
    {
        var formatted = DocumentNumberFormatter.Format("bkk01", docType, 2026, 11, 1);
        Assert.Equal(expected, formatted);
    }

    [Fact]
    public void Reservation_Hold_TTL_Should_Expire_After_HoldExpiresAt()
    {
        var now = new DateTimeOffset(2026, 11, 6, 10, 0, 0, TimeSpan.Zero);
        var reservation = Reservation.CreateOnlineHold(
            propertyId: Guid.CreateVersion7(),
            documentNumber: "BKK01-RES-2611-0009",
            customerId: Guid.CreateVersion7(),
            unitTypeId: Guid.CreateVersion7(),
            stayMode: StayMode.Daily,
            slotStartAt: now.AddDays(1),
            slotEndAt: now.AddDays(2),
            depositAmount: 500.00m,
            nowUtc: now,
            holdTtlMinutes: 15);

        var expiredEx = Assert.Throws<DomainRuleException>(() =>
            reservation.SubmitPaymentSlip("slips/slip01.jpg", now.AddMinutes(16)));

        Assert.Equal(DomainErrorCodes.ReservationHoldExpired, expiredEx.ErrorCode);
        Assert.Equal(ReservationStatus.Expired, reservation.Status);
    }

    [Fact]
    public void Stay_Folio_DepositLedger_And_Invoice_Invariants_Should_Be_Enforced()
    {
        var propertyId = Guid.CreateVersion7();
        var unit = new Unit
        {
            PropertyId = propertyId,
            BuildingId = Guid.CreateVersion7(),
            FloorId = Guid.CreateVersion7(),
            UnitTypeId = Guid.CreateVersion7(),
            UnitNumber = "A-301"
        };
        unit.MarkOccupied();

        var stay = new Stay
        {
            PropertyId = propertyId,
            DocumentNumber = "BKK01-STY-2611-0010",
            UnitId = unit.Id,
            CustomerId = Guid.CreateVersion7(),
            StayMode = StayMode.Daily,
            CheckInAt = DateTimeOffset.UtcNow,
            KeyDepositAmount = 500.00m
        };

        var folio = new Folio { PropertyId = propertyId, StayId = stay.Id };
        folio.AddCharge("Daily Room Charge", 1200.00m, TaxMode.VatIncluded);

        var depositLedger = new DepositLedger
        {
            PropertyId = propertyId,
            CustomerId = stay.CustomerId,
            StayId = stay.Id,
            DepositType = DepositType.KeyDeposit
        };
        depositLedger.RecordReceipt("BKK01-DEP-2611-0001", 500.00m);

        var unsettledFolioEx = Assert.Throws<DomainRuleException>(() =>
            stay.CompleteCheckOut(folio, depositLedger, DateTimeOffset.UtcNow));
        Assert.Equal(DomainErrorCodes.StayFolioUnsettled, unsettledFolioEx.ErrorCode);

        folio.RecordPayment(1200.00m);
        depositLedger.RefundRemainingBalance("BKK01-DEP-2611-0002", "Key returned intact");

        stay.CompleteCheckOut(folio, depositLedger, DateTimeOffset.UtcNow);
        Assert.Equal(StayStatus.CheckedOut, stay.Status);

        var housekeepingTask = unit.MarkCheckedOutOrMovedOut(stay.DocumentNumber);
        Assert.Equal(ConditionStatus.Dirty, unit.ConditionStatus);
        housekeepingTask.AdvanceUnitCondition(unit);
        Assert.Equal(ConditionStatus.Cleaning, unit.ConditionStatus);
        housekeepingTask.AdvanceUnitCondition(unit);
        Assert.Equal(ConditionStatus.Inspecting, unit.ConditionStatus);
        housekeepingTask.AdvanceUnitCondition(unit);
        Assert.Equal(ConditionStatus.Clean, unit.ConditionStatus);

        var invoice = new Invoice
        {
            PropertyId = propertyId,
            DocumentNumber = "BKK01-INV-2611-0010",
            CustomerId = stay.CustomerId,
            StayId = stay.Id
        };
        invoice.AddLine("Room Charge", 1200.00m, TaxMode.VatIncluded);
        invoice.Issue();

        var immutableEx = Assert.Throws<DomainRuleException>(() => invoice.EnsureCanDelete());
        Assert.Equal(DomainErrorCodes.InvoiceImmutableStatus, immutableEx.ErrorCode);

        var auditEvent = invoice.Void("Customer requested corporate tax details amendment");
        Assert.Equal(InvoiceStatus.Voided, invoice.Status);
        Assert.Equal("admin.invoice.void", auditEvent.ActionKey);
    }
}
