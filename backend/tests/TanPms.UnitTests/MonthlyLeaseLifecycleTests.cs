using TanPms.Application.Common.Abstractions;
using TanPms.Application.Customers;
using TanPms.Application.Leases;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class MonthlyLeaseLifecycleTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 20, 9, 0, 0, TimeSpan.Zero);

    private static CreateLeaseRequest NewLeaseOnA102(
        decimal deposit = 10000m,
        IReadOnlyList<LeaseVehicleRequest>? vehicles = null) => new(
        UnitId: PmsSeedConstants.DirtyUnitA102Id,
        CustomerId: PmsSeedConstants.SecondaryCustomerId,
        StartDate: new DateOnly(2026, 11, 20),
        EndDate: new DateOnly(2027, 5, 31),
        MonthlyRentAmount: 6500m,
        SecurityDepositAmount: deposit,
        InitialWaterMeterReading: 120m,
        InitialElectricMeterReading: 4500m,
        Occupants: [new LeaseOccupantRequest("Sudaawattana Jaidee", "THA", "3100909876541", true)],
        Vehicles: vehicles ?? [new LeaseVehicleRequest("2กค 1234", "Bangkok", "Honda City")]);

    [Fact]
    public void Monthly_Lease_Should_Occupy_Unit_And_Block_Hourly_CheckIn_And_Overlapping_Lease()
    {
        var store = new InMemoryOperationalService();

        var created = store.CreateAdminLease(PmsSeedConstants.BkkPropertyId, NewLeaseOnA102(), T0);

        Assert.True(created.IsSuccess, created.Error?.Message);
        var lease = created.Value!;
        Assert.StartsWith("BKK01-LSE-", lease.DocumentNumber, StringComparison.Ordinal);
        Assert.Equal("Active", lease.Status);
        Assert.Equal("A-102", lease.Unit.UnitNumber);
        Assert.Equal(10000m, lease.SecurityDepositBalance);
        Assert.Equal("3-xxxx-xxxxx-54-1", lease.Customer.MaskedNationalId);
        Assert.Single(lease.Occupants);
        Assert.Equal("2กค 1234", Assert.Single(lease.Vehicles).LicensePlate);

        var hourly = store.CheckInStay(
            new CheckInStayCommand(
                PropertyId: PmsSeedConstants.BkkPropertyId,
                UnitId: PmsSeedConstants.DirtyUnitA102Id,
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                StayMode: "Hourly",
                KeyDepositAmount: 0m,
                OverrideDirtyCheckIn: true,
                OverrideReason: "test"),
            callerHasOverridePermission: true,
            nowUtc: T0.AddHours(1));
        Assert.True(hourly.IsFailure);
        Assert.Equal(DomainErrorCodes.ReservationSlotOverlap, hourly.Error!.Code);

        var second = store.CreateAdminLease(
            PmsSeedConstants.BkkPropertyId,
            NewLeaseOnA102(vehicles: []),
            T0);
        Assert.True(second.IsFailure);
        Assert.Equal(DomainErrorCodes.ReservationSlotOverlap, second.Error!.Code);
    }

    [Fact]
    public void Create_Lease_Should_Reject_Invalid_Dates_And_Unit_Without_Monthly_Mode_Conflicts()
    {
        var store = new InMemoryOperationalService();

        var badDates = store.CreateAdminLease(
            PmsSeedConstants.BkkPropertyId,
            NewLeaseOnA102() with { EndDate = new DateOnly(2026, 11, 1) },
            T0);
        Assert.Equal(DomainErrorCodes.ValidationFailed, badDates.Error!.Code);

        var negativeMeter = store.CreateAdminLease(
            PmsSeedConstants.BkkPropertyId,
            NewLeaseOnA102() with { InitialWaterMeterReading = -1m },
            T0);
        Assert.Equal(DomainErrorCodes.ValidationFailed, negativeMeter.Error!.Code);

        // Upcoming confirmed reservation on A-102 inside the lease window -> slot overlap
        var reservation = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.DirtyUnitA102Id,
                StayMode: "Daily",
                SlotStartAt: new DateTimeOffset(2026, 12, 24, 14, 0, 0, TimeSpan.Zero),
                SlotEndAt: new DateTimeOffset(2026, 12, 26, 12, 0, 0, TimeSpan.Zero),
                DepositAmount: 0m,
                ConfirmImmediately: true),
            T0);
        Assert.True(reservation.IsSuccess, reservation.Error?.Message);

        var overlap = store.CreateAdminLease(PmsSeedConstants.BkkPropertyId, NewLeaseOnA102(), T0);
        Assert.Equal(DomainErrorCodes.ReservationSlotOverlap, overlap.Error!.Code);
    }

    [Fact]
    public void Plate_Search_Should_Match_TenantVehicle_And_Occupant_Plates_Ignoring_Spaces_And_Dashes()
    {
        var store = new InMemoryOperationalService();
        Assert.True(store.CreateAdminLease(PmsSeedConstants.BkkPropertyId, NewLeaseOnA102(), T0).IsSuccess);

        var byVehicle = store.GetAdminLeases(PmsSeedConstants.BkkPropertyId, null, "2กค-1234");
        Assert.Equal("A-102", Assert.Single(byVehicle.Value!.Items).Unit.UnitNumber);

        // Seeded A-201 occupant has VehicleLicensePlate "1กข-8899"
        var byOccupant = store.GetAdminLeases(PmsSeedConstants.BkkPropertyId, "Active", "1กข 8899");
        Assert.Equal("A-201", Assert.Single(byOccupant.Value!.Items).Unit.UnitNumber);

        Assert.Empty(store.GetAdminLeases(PmsSeedConstants.BkkPropertyId, null, "ZZ 0000").Value!.Items);
        Assert.Equal(2, store.GetAdminLeases(PmsSeedConstants.BkkPropertyId, null, null).Value!.Items.Count);

        var badStatus = store.GetAdminLeases(PmsSeedConstants.BkkPropertyId, "Nope", null);
        Assert.Equal(DomainErrorCodes.ValidationFailed, badStatus.Error!.Code);

        // Plate already registered on an active lease in the property
        var seedLeaseId = byOccupant.Value.Items[0].Id;
        var duplicate = store.AddAdminLeaseVehicle(
            PmsSeedConstants.BkkPropertyId,
            seedLeaseId,
            new LeaseVehicleRequest("2กค1234", null, null));
        Assert.Equal(DomainErrorCodes.ValidationFailed, duplicate.Error!.Code);

        var added = store.AddAdminLeaseVehicle(
            PmsSeedConstants.BkkPropertyId,
            seedLeaseId,
            new LeaseVehicleRequest("3ขค 7777", "Bangkok", "Toyota Yaris"));
        Assert.True(added.IsSuccess);
        Assert.Single(added.Value!.Vehicles);
    }

    [Fact]
    public void Settle_MoveOut_Should_Compute_Refund_And_Reject_Wrong_Status_And_Over_Deduction()
    {
        var store = new InMemoryOperationalService();
        var lease = store.CreateAdminLease(PmsSeedConstants.BkkPropertyId, NewLeaseOnA102(), T0).Value!;
        var settle = new SettleLeaseMoveOutRequest(1500m, 500m, "Final water/electric and wall repair");

        var tooEarly = store.SettleAdminLeaseMoveOut(PmsSeedConstants.BkkPropertyId, lease.Id, settle, T0);
        Assert.Equal(DomainErrorCodes.ValidationFailed, tooEarly.Error!.Code);

        var notice = store.GiveAdminLeaseMoveOutNotice(PmsSeedConstants.BkkPropertyId, lease.Id);
        Assert.Equal("MoveOutNotice", notice.Value!.Status);

        var overDeduction = store.SettleAdminLeaseMoveOut(
            PmsSeedConstants.BkkPropertyId,
            lease.Id,
            new SettleLeaseMoveOutRequest(9000m, 1000.01m, "Damage"),
            T0);
        Assert.Equal(DomainErrorCodes.ValidationFailed, overDeduction.Error!.Code);

        var noReason = store.SettleAdminLeaseMoveOut(
            PmsSeedConstants.BkkPropertyId,
            lease.Id,
            settle with { Reason = " " },
            T0);
        Assert.Equal(DomainErrorCodes.ValidationFailed, noReason.Error!.Code);

        var settled = store.SettleAdminLeaseMoveOut(PmsSeedConstants.BkkPropertyId, lease.Id, settle, T0);
        Assert.True(settled.IsSuccess, settled.Error?.Message);
        Assert.Equal(2000m, settled.Value!.DeductedAmount);
        Assert.Equal(8000m, settled.Value.RefundedAmount);
        Assert.Equal(0m, settled.Value.Lease.SecurityDepositBalance);
        Assert.Equal("MovedOut", settled.Value.Lease.Status);
        Assert.Equal("Pending", settled.Value.GeneratedHousekeepingTaskStatus);

        var again = store.SettleAdminLeaseMoveOut(PmsSeedConstants.BkkPropertyId, lease.Id, settle, T0);
        Assert.Equal(DomainErrorCodes.ValidationFailed, again.Error!.Code);

        // Unit is Vacant again (Dirty) so a new lease can be created on it
        var relet = store.CreateAdminLease(PmsSeedConstants.BkkPropertyId, NewLeaseOnA102(), T0.AddDays(1));
        Assert.True(relet.IsSuccess, relet.Error?.Message);
    }

    [Fact]
    public void Renew_Should_Validate_EndDate_And_Reject_Collision_With_Upcoming_Reservation()
    {
        var store = new InMemoryOperationalService();
        var lease = store.CreateAdminLease(PmsSeedConstants.BkkPropertyId, NewLeaseOnA102(), T0).Value!;

        var notLater = store.RenewAdminLease(
            PmsSeedConstants.BkkPropertyId,
            lease.Id,
            new RenewLeaseRequest(new DateOnly(2027, 5, 31)),
            T0);
        Assert.Equal(DomainErrorCodes.ValidationFailed, notLater.Error!.Code);

        var reservation = store.CreateAdminReservation(
            PmsSeedConstants.BkkPropertyId,
            new CreateAdminReservationRequest(
                CustomerId: PmsSeedConstants.PrimaryCustomerId,
                UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                UnitId: PmsSeedConstants.DirtyUnitA102Id,
                StayMode: "Daily",
                SlotStartAt: new DateTimeOffset(2027, 8, 1, 14, 0, 0, TimeSpan.Zero),
                SlotEndAt: new DateTimeOffset(2027, 8, 3, 12, 0, 0, TimeSpan.Zero),
                DepositAmount: 0m,
                ConfirmImmediately: true),
            T0);
        Assert.True(reservation.IsSuccess, reservation.Error?.Message);

        var collides = store.RenewAdminLease(
            PmsSeedConstants.BkkPropertyId,
            lease.Id,
            new RenewLeaseRequest(new DateOnly(2027, 11, 30)),
            T0);
        Assert.Equal(DomainErrorCodes.ReservationSlotOverlap, collides.Error!.Code);

        var renewed = store.RenewAdminLease(
            PmsSeedConstants.BkkPropertyId,
            lease.Id,
            new RenewLeaseRequest(new DateOnly(2027, 7, 31), 6800m),
            T0);
        Assert.True(renewed.IsSuccess, renewed.Error?.Message);
        Assert.Equal(new DateOnly(2027, 7, 31), renewed.Value!.EndDate);
        Assert.Equal(6800m, renewed.Value.MonthlyRentAmount);

        Assert.True(store.GiveAdminLeaseMoveOutNotice(PmsSeedConstants.BkkPropertyId, lease.Id).IsSuccess);
        var renewAfterNotice = store.RenewAdminLease(
            PmsSeedConstants.BkkPropertyId,
            lease.Id,
            new RenewLeaseRequest(new DateOnly(2027, 7, 1).AddDays(40)),
            T0);
        Assert.True(renewAfterNotice.IsFailure);
    }

    [Fact]
    public void Lease_Handlers_Should_Enforce_Property_Scope_And_Permissions_And_Audit_Settlement()
    {
        var store = new InMemoryOperationalService();
        var managerOnly = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminLeasesManage }
        };
        var otherProperty = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.CnxPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminLeasesManage, PermissionKeys.AdminLeasesSettleMoveOut }
        };

        var deniedList = new GetAdminLeasesHandler(store, otherProperty)
            .Handle(new GetAdminLeasesQuery(PmsSeedConstants.BkkPropertyId, null, null));
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, deniedList.Error!.Code);

        var created = new CreateAdminLeaseHandler(store, managerOnly, store)
            .Handle(new CreateAdminLeaseCommand(PmsSeedConstants.BkkPropertyId, NewLeaseOnA102()));
        Assert.True(created.IsSuccess, created.Error?.Message);
        Assert.Contains(store.AuditEvents, e =>
            e.ActionKey == PermissionKeys.AdminLeasesManage && e.EntityId == created.Value!.Id);

        Assert.True(new GiveAdminLeaseMoveOutNoticeHandler(store, managerOnly, store)
            .Handle(new GiveAdminLeaseMoveOutNoticeCommand(PmsSeedConstants.BkkPropertyId, created.Value!.Id))
            .IsSuccess);

        var settle = new SettleAdminLeaseMoveOutCommand(
            PmsSeedConstants.BkkPropertyId,
            created.Value.Id,
            new SettleLeaseMoveOutRequest(0m, 0m, "Clean handover"));

        var deniedSettle = new SettleAdminLeaseMoveOutHandler(store, managerOnly, store).Handle(settle);
        Assert.Equal(DomainErrorCodes.PermissionDenied, deniedSettle.Error!.Code);

        var settler = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminLeasesSettleMoveOut }
        };
        var settled = new SettleAdminLeaseMoveOutHandler(store, settler, store).Handle(settle);
        Assert.True(settled.IsSuccess, settled.Error?.Message);
        Assert.Equal(10000m, settled.Value!.RefundedAmount);
        Assert.Contains(store.AuditEvents, e =>
            e.ActionKey == PermissionKeys.AdminLeasesSettleMoveOut
            && e.EntityId == created.Value.Id
            && e.Reason == "Clean handover");
    }

    [Fact]
    public void Get_Lease_By_Id_Should_Return_Item_Reject_Unknown_And_Deny_Other_Property()
    {
        var store = new InMemoryOperationalService();
        var leaseId = store.GetAdminLeases(PmsSeedConstants.BkkPropertyId, null, null).Value!.Items.Single().Id;
        var reader = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminPropertiesRead }
        };

        var found = new GetAdminLeaseHandler(store, reader)
            .Handle(new GetAdminLeaseQuery(PmsSeedConstants.BkkPropertyId, leaseId));
        Assert.True(found.IsSuccess, found.Error?.Message);
        Assert.Equal("A-201", found.Value!.Unit.UnitNumber);
        Assert.Equal("1-xxxx-xxxxx-12-3", found.Value.Customer.MaskedNationalId);

        var unknown = new GetAdminLeaseHandler(store, reader)
            .Handle(new GetAdminLeaseQuery(PmsSeedConstants.BkkPropertyId, Guid.NewGuid()));
        Assert.Equal(DomainErrorCodes.ValidationFailed, unknown.Error!.Code);

        var wrongProperty = new GetAdminLeaseHandler(store, reader)
            .Handle(new GetAdminLeaseQuery(PmsSeedConstants.CnxPropertyId, leaseId));
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, wrongProperty.Error!.Code);

        var unmasker = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminLeasesManage, PermissionKeys.AdminCustomerUnmaskPii }
        };
        var unmasked = new GetAdminLeaseHandler(store, unmasker)
            .Handle(new GetAdminLeaseQuery(PmsSeedConstants.BkkPropertyId, leaseId));
        Assert.Equal("1100501234123", unmasked.Value!.Customer.MaskedNationalId);
    }

    [Fact]
    public void Customer_Search_Should_Match_Name_Or_Last_Digits_Mask_Ids_Cap_Results_And_Enforce_Scope()
    {
        var store = new InMemoryOperationalService();
        var lookup = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminCustomerUnmaskPii }
        };
        var handler = new SearchAdminCustomersHandler(store, lookup);

        var byName = handler.Handle(new SearchAdminCustomersQuery(PmsSeedConstants.BkkPropertyId, "somchai"));
        var somchai = Assert.Single(byName.Value!.Items);
        Assert.Equal("1-xxxx-xxxxx-12-3", somchai.MaskedNationalId);

        var byDigits = handler.Handle(new SearchAdminCustomersQuery(PmsSeedConstants.BkkPropertyId, "6541"));
        Assert.Equal(PmsSeedConstants.SecondaryCustomerId, Assert.Single(byDigits.Value!.Items).Id);

        // Reservations for unknown customers register placeholder "Guest Customer" records (25 of them).
        for (var i = 0; i < 25; i++)
        {
            var start = new DateTimeOffset(2028, 1, 1, 10, 0, 0, TimeSpan.Zero).AddDays(i * 2);
            Assert.True(store.CreateAdminReservation(
                PmsSeedConstants.BkkPropertyId,
                new CreateAdminReservationRequest(
                    CustomerId: Guid.NewGuid(),
                    UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
                    UnitId: null,
                    StayMode: "Hourly",
                    SlotStartAt: start,
                    SlotEndAt: start.AddHours(3),
                    DepositAmount: 0m,
                    ConfirmImmediately: true),
                T0).IsSuccess);
        }

        var capped = handler.Handle(new SearchAdminCustomersQuery(PmsSeedConstants.BkkPropertyId, "guest"));
        Assert.Equal(CustomerSearchRules.MaxResults, capped.Value!.Items.Count);
        Assert.All(capped.Value.Items, c => Assert.DoesNotContain("1100501234999", c.MaskedNationalId));

        var noPermission = new SearchAdminCustomersHandler(store, new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId },
            Permissions = new HashSet<string> { PermissionKeys.AdminRatesManage }
        }).Handle(new SearchAdminCustomersQuery(PmsSeedConstants.BkkPropertyId, null));
        Assert.Equal(DomainErrorCodes.PermissionDenied, noPermission.Error!.Code);
    }

    private sealed class TestCurrentUserContext : ICurrentUserContext
    {
        public string UserId { get; set; } = "test-user";
        public bool IsAdminScope { get; set; }
        public bool IsClientScope { get; set; }
        public IReadOnlySet<Guid> AllowedPropertyIds { get; set; } = new HashSet<Guid>();
        public IReadOnlySet<string> Permissions { get; set; } = new HashSet<string>();
        public Guid? CustomerId { get; set; }
        public bool HasOpenCashierShift { get; set; }
    }
}
