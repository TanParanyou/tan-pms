using TanPms.Application.Reservations;
using TanPms.Domain.Common;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class UnifiedAvailabilityAndReservationTests
{
    [Fact]
    public void Hourly_TurnaroundBuffer_Should_Block_Adjacent_Slot_Until_Buffer_Elapses()
    {
        var store = new InMemoryOperationalService();
        var nowUtc = new DateTimeOffset(2026, 12, 1, 8, 0, 0, TimeSpan.Zero);
        var slot1Start = new DateTimeOffset(2026, 12, 5, 10, 0, 0, TimeSpan.Zero);
        var slot1End = new DateTimeOffset(2026, 12, 5, 13, 0, 0, TimeSpan.Zero);

        var created = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                StayMode: "Hourly",
                SlotStartAt: slot1Start,
                SlotEndAt: slot1End,
                DepositAmount: 250m,
                ConfirmImmediately: true),
            nowUtc);

        Assert.True(created.IsSuccess);
        Assert.Equal(slot1End.AddMinutes(30), created.Value!.EffectiveBlockedEndAt);

        // 13:15 overlaps with 30-minute turnaround buffer (13:00 -> 13:30) on Unit A-101
        var overlappingOnSameUnit = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.SecondaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                StayMode: "Hourly",
                SlotStartAt: new DateTimeOffset(2026, 12, 5, 13, 15, 0, TimeSpan.Zero),
                SlotEndAt: new DateTimeOffset(2026, 12, 5, 16, 15, 0, TimeSpan.Zero),
                DepositAmount: 250m,
                ConfirmImmediately: true),
            nowUtc);

        Assert.True(overlappingOnSameUnit.IsFailure);
        Assert.Equal(DomainErrorCodes.ReservationSlotOverlap, overlappingOnSameUnit.Error.Code);

        // 13:30 starts right after the 30-minute turnaround buffer, so Unit A-101 is available again
        var afterBufferOnSameUnit = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.SecondaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                StayMode: "Hourly",
                SlotStartAt: new DateTimeOffset(2026, 12, 5, 13, 30, 0, TimeSpan.Zero),
                SlotEndAt: new DateTimeOffset(2026, 12, 5, 16, 30, 0, TimeSpan.Zero),
                DepositAmount: 250m,
                ConfirmImmediately: true),
            nowUtc);

        Assert.True(afterBufferOnSameUnit.IsSuccess);
    }

    [Fact]
    public void Active_Monthly_Lease_Should_Zero_Out_Deluxe_UnitType_Availability()
    {
        var store = new InMemoryOperationalService();
        var nowUtc = new DateTimeOffset(2026, 11, 10, 9, 0, 0, TimeSpan.Zero);

        var search = store.SearchAvailability(
            PmsSeedConstants.BkkPropertyId,
            "Daily",
            new DateTimeOffset(2026, 11, 15, 14, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 11, 16, 12, 0, 0, TimeSpan.Zero),
            nowUtc);

        Assert.True(search.IsSuccess);
        var deluxe = Assert.Single(search.Value!.Items, x => x.UnitType.Id == PmsSeedConstants.DeluxeUnitTypeId);
        Assert.Equal(0, deluxe.NetAvailableQuota);
        Assert.Empty(deluxe.AvailableUnits);
    }

    [Fact]
    public void Mixed_SpecificUnit_And_UnassignedQuota_Should_Prevent_OverAllocation_And_Allow_Unit_Assignment()
    {
        var store = new InMemoryOperationalService();
        var nowUtc = new DateTimeOffset(2026, 12, 1, 9, 0, 0, TimeSpan.Zero);
        var slotStart = new DateTimeOffset(2026, 12, 10, 14, 0, 0, TimeSpan.Zero);
        var slotEnd = new DateTimeOffset(2026, 12, 11, 12, 0, 0, TimeSpan.Zero);

        // 1. Specific unit reservation on A-101 (Standard has 2 physical units: A-101, A-102)
        var resSpecific = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.CleanUnitA101Id,
                StayMode: "Daily",
                SlotStartAt: slotStart,
                SlotEndAt: slotEnd,
                DepositAmount: 600m,
                ConfirmImmediately: true),
            nowUtc);
        Assert.True(resSpecific.IsSuccess);

        // 2. Unassigned online Hold takes the remaining 1 quota
        var resQuota = store.CreateClientHoldReservation(
            PmsSeedConstants.SecondaryCustomerId,
            new CreateClientHoldReservationRequest(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: null,
                StayMode: "Daily",
                SlotStartAt: slotStart,
                SlotEndAt: slotEnd),
            nowUtc);
        Assert.True(resQuota.IsSuccess);

        // 3. Attempting to book A-102 specifically MUST fail because A-102 is needed to fulfill resQuota!
        var overSpecific = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.DirtyUnitA102Id,
                StayMode: "Daily",
                SlotStartAt: slotStart,
                SlotEndAt: slotEnd,
                DepositAmount: 600m,
                ConfirmImmediately: true),
            nowUtc);
        Assert.True(overSpecific.IsFailure);
        Assert.Equal(DomainErrorCodes.ReservationQuotaExhausted, overSpecific.Error.Code);

        // 4. Assigning A-102 to resQuota itself MUST succeed (and assigning A-101 MUST fail with overlap)
        var assignBusyA101 = store.AssignReservationUnit(
            PmsSeedConstants.BkkPropertyId,
            resQuota.Value!.Id,
            PmsSeedConstants.CleanUnitA101Id,
            nowUtc);
        Assert.True(assignBusyA101.IsFailure);
        Assert.Equal(DomainErrorCodes.ReservationSlotOverlap, assignBusyA101.Error.Code);

        var assignFreeA102 = store.AssignReservationUnit(
            PmsSeedConstants.BkkPropertyId,
            resQuota.Value.Id,
            PmsSeedConstants.DirtyUnitA102Id,
            nowUtc);
        Assert.True(assignFreeA102.IsSuccess);
        Assert.Equal("A-102", assignFreeA102.Value!.AssignedUnit?.UnitNumber);
    }

    [Fact]
    public async Task Parallel_Concurrent_Online_Holds_Should_Strictly_Cap_At_Available_Quota_With_Zero_Document_Collision()
    {
        var store = new InMemoryOperationalService();
        var nowUtc = new DateTimeOffset(2026, 12, 1, 10, 0, 0, TimeSpan.Zero);
        var slotStart = new DateTimeOffset(2026, 12, 18, 14, 0, 0, TimeSpan.Zero);
        var slotEnd = new DateTimeOffset(2026, 12, 19, 12, 0, 0, TimeSpan.Zero);

        // Standard UnitType has 2 available physical units in this window; fire 20 concurrent Hold requests
        var tasks = Enumerable.Range(0, 20)
            .Select(_ => Task.Run(() => store.CreateClientHoldReservation(
                Guid.NewGuid(),
                new CreateClientHoldReservationRequest(
                    PropertyId: PmsSeedConstants.BkkPropertyId,
                    UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                    UnitId: null,
                    StayMode: "Daily",
                    SlotStartAt: slotStart,
                    SlotEndAt: slotEnd),
                nowUtc)))
            .ToArray();

        var results = await Task.WhenAll(tasks);

        var successes = results.Where(r => r.IsSuccess).ToList();
        var failures = results.Where(r => r.IsFailure).ToList();

        Assert.Equal(2, successes.Count);
        Assert.Equal(18, failures.Count);
        Assert.All(failures, f => Assert.Equal(DomainErrorCodes.ReservationQuotaExhausted, f.Error.Code));

        var distinctDocNumbers = successes.Select(s => s.Value!.DocumentNumber).Distinct().ToList();
        Assert.Equal(2, distinctDocNumbers.Count);
    }

    [Fact]
    public void Hold_Ttl_Expiry_Should_Reject_Late_Slip_And_Automatically_Restore_Quota()
    {
        var store = new InMemoryOperationalService();
        var t0 = new DateTimeOffset(2026, 12, 2, 10, 0, 0, TimeSpan.Zero);
        var slotStart = new DateTimeOffset(2026, 12, 24, 14, 0, 0, TimeSpan.Zero);
        var slotEnd = new DateTimeOffset(2026, 12, 25, 12, 0, 0, TimeSpan.Zero);

        var hold = store.CreateClientHoldReservation(
            PmsSeedConstants.PrimaryCustomerId,
            new CreateClientHoldReservationRequest(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: null,
                StayMode: "Daily",
                SlotStartAt: slotStart,
                SlotEndAt: slotEnd),
            t0);

        Assert.True(hold.IsSuccess);
        Assert.Equal("Hold", hold.Value!.Status);

        var duringHold = store.SearchAvailability(
            PmsSeedConstants.BkkPropertyId,
            "Daily",
            slotStart,
            slotEnd,
            t0.AddMinutes(5));
        var stdDuring = Assert.Single(duringHold.Value!.Items, x => x.UnitType.Id == PmsSeedConstants.StandardUnitTypeId);
        Assert.Equal(1, stdDuring.NetAvailableQuota);

        // Advance clock past 15-minute TTL -> late slip submission must fail with reservation.hold_expired
        var lateTime = t0.AddMinutes(16);
        var lateSlip = store.SubmitClientReservationSlip(
            PmsSeedConstants.PrimaryCustomerId,
            hold.Value.Id,
            new SubmitReservationSlipRequest("uploads/slips/late-slip.png"),
            lateTime);

        Assert.True(lateSlip.IsFailure);
        Assert.Equal(DomainErrorCodes.ReservationHoldExpired, lateSlip.Error.Code);

        // Availability quota must be restored back to 2
        var afterExpiry = store.SearchAvailability(
            PmsSeedConstants.BkkPropertyId,
            "Daily",
            slotStart,
            slotEnd,
            lateTime);
        var stdAfter = Assert.Single(afterExpiry.Value!.Items, x => x.UnitType.Id == PmsSeedConstants.StandardUnitTypeId);
        Assert.Equal(2, stdAfter.NetAvailableQuota);
    }
}
