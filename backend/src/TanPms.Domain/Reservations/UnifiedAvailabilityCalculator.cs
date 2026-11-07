using TanPms.Domain.Common;
using TanPms.Domain.Leases;
using TanPms.Domain.Properties;
using TanPms.Domain.Stays;

namespace TanPms.Domain.Reservations;

public static class UnifiedAvailabilityCalculator
{
    public static bool IntervalsOverlap(
        DateTimeOffset startA,
        DateTimeOffset endA,
        DateTimeOffset startB,
        DateTimeOffset endB) =>
        startA < endB && startB < endA;

    public static UnitTypeAvailabilityResult EvaluateUnitTypeAvailability(
        UnitType unitType,
        IEnumerable<Unit> unitsOfUnitType,
        IEnumerable<Lease> propertyLeases,
        IEnumerable<Stay> propertyStays,
        IEnumerable<Reservation> propertyReservations,
        StayMode requestedStayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt,
        DateTimeOffset nowUtc,
        int turnaroundBufferMinutes = 30,
        Guid? ignoreReservationId = null)
    {
        if (slotEndAt <= slotStartAt)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Requested SlotEndAt must be strictly after SlotStartAt.",
                httpStatus: 400);
        }

        var buffer = Math.Max(0, turnaroundBufferMinutes);
        var effectiveEndAt = requestedStayMode == StayMode.Hourly
            ? slotEndAt.AddMinutes(buffer)
            : slotEndAt;

        var physicalUnits = unitsOfUnitType
            .Where(u => u.PropertyId == unitType.PropertyId && u.UnitTypeId == unitType.Id)
            .ToList();

        var activeLeases = propertyLeases
            .Where(l => l.PropertyId == unitType.PropertyId && l.BlocksUnitAvailability)
            .ToList();

        var activeStays = propertyStays
            .Where(s => s.PropertyId == unitType.PropertyId && s.Status == StayStatus.Active)
            .ToList();

        var activeReservations = propertyReservations
            .Where(r => r.PropertyId == unitType.PropertyId
                        && (!ignoreReservationId.HasValue || r.Id != ignoreReservationId.Value)
                        && r.BlocksInventory(nowUtc))
            .ToList();

        var availableUnitIds = new List<Guid>();

        foreach (var unit in physicalUnits)
        {
            if (unit.OccupancyStatus == OccupancyStatus.Blocked
                || unit.ConditionStatus == ConditionStatus.OutOfOrder)
            {
                continue;
            }

            if (!unit.SupportedStayModes.Contains(requestedStayMode))
            {
                continue;
            }

            var blockedByLease = activeLeases.Any(l =>
            {
                if (l.UnitId != unit.Id) return false;
                var leaseStart = new DateTimeOffset(l.StartDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
                var leaseEnd = new DateTimeOffset(l.EndDate.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
                return IntervalsOverlap(slotStartAt, effectiveEndAt, leaseStart, leaseEnd);
            });

            if (blockedByLease)
            {
                continue;
            }

            var blockedByStay = activeStays.Any(s =>
            {
                if (s.UnitId != unit.Id) return false;
                var stayEnd = s.ExpectedCheckOutAt ?? s.CheckInAt.AddDays(1);
                var effectiveStayEnd = s.StayMode == StayMode.Hourly
                    ? stayEnd.AddMinutes(buffer)
                    : stayEnd;
                return IntervalsOverlap(slotStartAt, effectiveEndAt, s.CheckInAt, effectiveStayEnd);
            });

            if (blockedByStay)
            {
                continue;
            }

            var blockedBySpecificReservation = activeReservations.Any(r =>
            {
                if (r.UnitId != unit.Id) return false;
                var resEffectiveEnd = r.GetEffectiveBlockedEndAt(buffer);
                return IntervalsOverlap(slotStartAt, effectiveEndAt, r.SlotStartAt, resEffectiveEnd);
            });

            if (blockedBySpecificReservation)
            {
                continue;
            }

            availableUnitIds.Add(unit.Id);
        }

        var overlappingUnassignedQuota = activeReservations.Count(r =>
            r.UnitTypeId == unitType.Id
            && r.UnitId is null
            && IntervalsOverlap(slotStartAt, effectiveEndAt, r.SlotStartAt, r.GetEffectiveBlockedEndAt(buffer)));

        var netAvailableQuota = Math.Max(0, availableUnitIds.Count - overlappingUnassignedQuota);

        return new UnitTypeAvailabilityResult(
            UnitTypeId: unitType.Id,
            TotalPhysicalUnits: physicalUnits.Count,
            UnassignedQuotaHeld: overlappingUnassignedQuota,
            NetAvailableQuota: netAvailableQuota,
            TurnaroundBufferMinutes: buffer,
            AvailableUnitIds: availableUnitIds);
    }

    public static void EnsureSpecificUnitAvailable(
        Guid requestedUnitId,
        UnitTypeAvailabilityResult availabilityResult)
    {
        if (!availabilityResult.AvailableUnitIds.Contains(requestedUnitId))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ReservationSlotOverlap,
                $"Unit '{requestedUnitId}' overlaps with an existing Stay, Lease, or Reservation in the requested window.");
        }
    }

    public static void EnsureQuotaAvailable(UnitTypeAvailabilityResult availabilityResult)
    {
        if (availabilityResult.NetAvailableQuota <= 0)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ReservationQuotaExhausted,
                $"UnitType '{availabilityResult.UnitTypeId}' has zero net available quota for the requested window.");
        }
    }
}
