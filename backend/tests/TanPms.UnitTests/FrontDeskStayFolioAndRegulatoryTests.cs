using TanPms.Application.Common.Contracts;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class FrontDeskStayFolioAndRegulatoryTests
{
    [Fact]
    public void Hourly_Stay_Extend_Should_Isolate_KeyDeposit_And_AutoCap_RoomCharge_At_DailyRate()
    {
        var store = new InMemoryOperationalService();
        var t0 = new DateTimeOffset(2026, 11, 8, 9, 0, 0, TimeSpan.Zero);

        var checkIn = store.CheckInStay(
            new CheckInStayCommand(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                StayMode: "Hourly",
                KeyDepositAmount: 500.00m),
            callerHasOverridePermission: false,
            nowUtc: t0);

        Assert.True(checkIn.IsSuccess);

        var activeList = store.GetAdminStays(PmsSeedConstants.BkkPropertyId, "Active", "Hourly", nowUtc: t0.AddMinutes(30));
        var stay = Assert.Single(activeList.Value!.Items, s => s.Id == checkIn.Value!.Id);

        // Key deposit (500) is strictly isolated from Folio charges (500 base 3h package)
        Assert.Equal(500.00m, stay.KeyDepositBalance);
        Assert.Equal(500.00m, stay.Folio.TotalCharges);
        Assert.Equal(150, stay.RemainingMinutes);
        Assert.False(stay.IsOvertime);

        // Extend +2h -> 500 + (2 * 150) = 800 (delta +300)
        var ext1 = store.ExtendAdminStay(
            PmsSeedConstants.BkkPropertyId,
            stay.Id,
            new ExtendStayRequest(2),
            t0.AddHours(1));
        Assert.True(ext1.IsSuccess);
        Assert.Equal(800.00m, ext1.Value!.Folio.TotalCharges);

        // Extend +5h -> total 10h raw 500 + 7*150 = 1550, capped at AutoCapToDailyRate = 1200 (delta +400)
        var ext2 = store.ExtendAdminStay(
            PmsSeedConstants.BkkPropertyId,
            stay.Id,
            new ExtendStayRequest(5),
            t0.AddHours(2));
        Assert.True(ext2.IsSuccess);
        Assert.Equal(1200.00m, ext2.Value!.Folio.TotalCharges);
    }

    [Fact]
    public void Hourly_Stay_Extend_Should_Reject_When_Overlapping_Upcoming_Reservation_With_TurnaroundBuffer()
    {
        var store = new InMemoryOperationalService();
        var t0 = new DateTimeOffset(2026, 11, 9, 10, 0, 0, TimeSpan.Zero);

        // Confirmed reservation on A-101 starting at 14:00
        var upcomingRes = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.SecondaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                StayMode: "Daily",
                SlotStartAt: new DateTimeOffset(2026, 11, 9, 14, 0, 0, TimeSpan.Zero),
                SlotEndAt: new DateTimeOffset(2026, 11, 10, 12, 0, 0, TimeSpan.Zero),
                DepositAmount: 600m,
                ConfirmImmediately: true),
            t0);
        Assert.True(upcomingRes.IsSuccess);

        // Check in 10:00 -> ExpectedCheckOutAt 13:00 (effective end with 30m turnaround = 13:30, safe)
        var checkIn = store.CheckInStay(
            new CheckInStayCommand(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                StayMode: "Hourly",
                KeyDepositAmount: 200m),
            callerHasOverridePermission: false,
            nowUtc: t0);
        Assert.True(checkIn.IsSuccess);

        // Extending +1h makes ExpectedCheckOutAt 14:00 (+30m buffer = 14:30), colliding with 14:00 reservation
        var blockedExtend = store.ExtendAdminStay(
            PmsSeedConstants.BkkPropertyId,
            checkIn.Value!.Id,
            new ExtendStayRequest(1),
            t0.AddHours(2));

        Assert.True(blockedExtend.IsFailure);
        Assert.Equal(DomainErrorCodes.ReservationSlotOverlap, blockedExtend.Error.Code);
    }

    [Fact]
    public void CheckOut_Should_Enforce_Zero_Folio_Balance_Settle_KeyDeposit_Mark_Unit_Dirty_And_Create_HousekeepingTask()
    {
        var store = new InMemoryOperationalService();
        var t0 = new DateTimeOffset(2026, 11, 10, 11, 0, 0, TimeSpan.Zero);

        var checkIn = store.CheckInStay(
            new CheckInStayCommand(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                StayMode: "Hourly",
                KeyDepositAmount: 500.00m),
            callerHasOverridePermission: false,
            nowUtc: t0);
        Assert.True(checkIn.IsSuccess);
        var stayId = checkIn.Value!.Id;

        var afterMinibar = store.AddAdminFolioCharge(
            PmsSeedConstants.BkkPropertyId,
            stayId,
            new AddFolioChargeRequest(
                new LocalizedTextDto("น้ำแร่และมินิบาร์", "Mineral Water & Minibar"),
                120.00m,
                "VatIncluded"),
            t0.AddHours(1));
        Assert.True(afterMinibar.IsSuccess);
        Assert.Equal(620.00m, afterMinibar.Value!.Folio.BalanceDue);

        // Unsettled Folio must block CheckOut with stay.folio_unsettled
        var prematureCheckOut = store.CheckOutAdminStay(
            PmsSeedConstants.BkkPropertyId,
            stayId,
            new CheckOutStayRequest(0m, "Early attempt"),
            t0.AddHours(2));
        Assert.True(prematureCheckOut.IsFailure);
        Assert.Equal(DomainErrorCodes.StayFolioUnsettled, prematureCheckOut.Error.Code);

        // Settle Folio completely
        var paid = store.RecordAdminFolioPayment(
            PmsSeedConstants.BkkPropertyId,
            stayId,
            new RecordFolioPaymentRequest(620.00m, "PromptPay"),
            t0.AddHours(2));
        Assert.True(paid.IsSuccess);
        Assert.Equal(0.00m, paid.Value!.Folio.BalanceDue);

        // Complete CheckOut with 100 THB key deposit deduction + 400 THB refund
        var checkedOut = store.CheckOutAdminStay(
            PmsSeedConstants.BkkPropertyId,
            stayId,
            new CheckOutStayRequest(100.00m, "Deducted broken key ring 100 THB and refunded remaining 400 THB"),
            t0.AddHours(3));

        Assert.True(checkedOut.IsSuccess);
        Assert.Equal("CheckedOut", checkedOut.Value!.Status);
        Assert.Equal(0.00m, checkedOut.Value.KeyDepositBalance);
        Assert.Equal("Pending", checkedOut.Value.GeneratedHousekeepingTaskStatus);

        var rack = store.GetRoomRack(PmsSeedConstants.BkkPropertyId);
        var unitA101 = Assert.Single(rack.Value!.Items, i => i.Unit.Id == PmsSeedConstants.CleanUnitA101Id);
        Assert.Equal("Vacant", unitA101.OccupancyStatus);
        Assert.Equal("Dirty", unitA101.ConditionStatus);
    }

    [Fact]
    public void Regulatory_Exports_Should_Filter_TM30_Foreign_Guests_And_Respect_Pii_Masking()
    {
        var store = new InMemoryOperationalService();
        var t0 = new DateTimeOffset(2026, 11, 11, 14, 0, 0, TimeSpan.Zero);

        var checkIn = store.CheckInStay(
            new CheckInStayCommand(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                StayMode: "Daily",
                KeyDepositAmount: 500m,
                Occupants:
                [
                    new CheckInOccupantInputDto("Somchai Rakdee", "THA", "1100501234123", true, "2ขค-4567"),
                    new CheckInOccupantInputDto("Kenji Takahashi", "JPN", "TK8844221", false, null)
                ]),
            callerHasOverridePermission: false,
            nowUtc: t0);
        Assert.True(checkIn.IsSuccess);

        var rr4Masked = store.GetAdminRegulatoryExport(PmsSeedConstants.BkkPropertyId, "RR4", unmaskPii: false, nowUtc: t0);
        Assert.True(rr4Masked.IsSuccess);
        Assert.Contains(rr4Masked.Value!.Rows, r => r.NationalityCode == "THA" && r.IdentityNumber == "1-xxxx-xxxxx-12-3");
        Assert.Contains(rr4Masked.Value.Rows, r => r.NationalityCode == "JPN" && r.IdentityNumber == "TKxxxx221");

        var tm30Unmasked = store.GetAdminRegulatoryExport(PmsSeedConstants.BkkPropertyId, "TM30", unmaskPii: true, nowUtc: t0);
        Assert.True(tm30Unmasked.IsSuccess);
        Assert.DoesNotContain(tm30Unmasked.Value!.Rows, r => r.NationalityCode == "THA");
        Assert.Contains(tm30Unmasked.Value.Rows, r => r.FullName == "Kenji Takahashi" && r.IdentityNumber == "TK8844221");
    }
}
