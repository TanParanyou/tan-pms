using TanPms.Application.Analytics;
using TanPms.Application.Cashier;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Identity;
using TanPms.Application.Leases;
using TanPms.Application.Properties;
using TanPms.Application.Rates;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Domain.Common;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

// PM-01..PM-05 CRUD gaps: user (de)activation, guarded master-data deletes, reservation edits and stay corrections.
public sealed class MasterDataAndStayLifecycleTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;
    private static readonly Guid Cnx = PmsSeedConstants.CnxPropertyId;

    private static TestCurrentUserContext Admin(string userId, IEnumerable<Guid> properties, params string[] permissions) => new()
    {
        UserId = userId,
        IsAdminScope = true,
        HasOpenCashierShift = true,
        AllowedPropertyIds = properties.ToHashSet(),
        Permissions = new HashSet<string>(permissions)
    };

    private static TestCurrentUserContext BkkAdmin(params string[] permissions) => Admin("pimchanok.bkk", [Bkk], permissions);

    [Fact]
    public void Users_Should_Be_Readable_In_Scope_And_Deactivated_Softly_With_Guards_And_Audit()
    {
        var store = new InMemoryOperationalService();
        var users = store.GetAdminUsers(null, new HashSet<Guid> { Bkk, Cnx }).Value!.Items;
        var orgAdmin = users.Single(u => u.Username == "naphat.admin");
        var cashier = users.Single(u => u.Username == "pimchanok.bkk");
        var manager = Admin(orgAdmin.Id.ToString(), [Bkk, Cnx], PermissionKeys.AdminUsersRead, PermissionKeys.AdminUsersManage);

        Assert.Equal("Pimchanok Srisawat", new GetAdminUserHandler(store, manager).Handle(new GetAdminUserQuery(cashier.Id)).Value!.FullName);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminUserHandler(store, Admin("cnx", [Cnx], PermissionKeys.AdminUsersRead))
            .Handle(new GetAdminUserQuery(cashier.Id)).Error!.Code);

        var deactivate = new DeactivateAdminUserHandler(store, manager, store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, deactivate.Handle(new DeactivateAdminUserCommand(cashier.Id, new ReasonRequest(" "))).Error!.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, deactivate.Handle(new DeactivateAdminUserCommand(orgAdmin.Id, new ReasonRequest("x"))).Error!.Code); // self
        Assert.False(deactivate.Handle(new DeactivateAdminUserCommand(cashier.Id, new ReasonRequest("Resigned"))).Value!.IsActive);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == IdentityRules.DeactivateActionKey && e.Reason == "Resigned");
        Assert.True(new ReactivateAdminUserHandler(store, manager, store).Handle(new ReactivateAdminUserCommand(cashier.Id)).Value!.IsActive);

        // The only Organization Admin can neither be deactivated nor demoted by someone else.
        var otherManager = Admin("someone-else", [Bkk, Cnx], PermissionKeys.AdminUsersManage);
        Assert.Equal(DomainErrorCodes.MasterDataInUse, new DeactivateAdminUserHandler(store, otherManager, store)
            .Handle(new DeactivateAdminUserCommand(orgAdmin.Id, new ReasonRequest("x"))).Error!.Code);
        Assert.Equal(DomainErrorCodes.MasterDataInUse, store.UpsertAdminUser(new UpsertAdminUserCommand(
            orgAdmin.Id, orgAdmin.Username, orgAdmin.FullName, orgAdmin.Email, RoleCodes.PropertyManager, [Bkk], true)).Error!.Code);
    }

    [Fact]
    public void Hierarchy_And_Rates_Should_Upsert_And_Only_Delete_Unused_Records()
    {
        var store = new InMemoryOperationalService();
        var manage = BkkAdmin(PermissionKeys.AdminPropertiesManage, PermissionKeys.AdminPropertiesRead, PermissionKeys.AdminRatesManage);
        var building = new UpsertAdminBuildingHandler(store, manage, store)
            .Handle(new UpsertAdminBuildingCommand(Bkk, new UpsertBuildingRequest(null, "bld-b", new LocalizedTextDto("อาคาร B", "Building B")))).Value!;
        Assert.Equal("BLD-B", building.Code);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpsertBuilding(Bkk, new UpsertBuildingRequest(null, "BLD-B", new LocalizedTextDto("ซ้ำ"))).Error!.Code);
        var floor = new UpsertAdminFloorHandler(store, manage, store)
            .Handle(new UpsertAdminFloorCommand(Bkk, new UpsertFloorRequest(null, building.Id, 1, new LocalizedTextDto("ชั้น 1", "Floor 1")))).Value!;
        var unitType = new UpsertAdminUnitTypeHandler(store, manage, store).Handle(new UpsertAdminUnitTypeCommand(Bkk, new UpsertUnitTypeRequest(
            null, "suite", new LocalizedTextDto("สวีท", "Suite"), null, 48m, 1, ["Daily", "Monthly"], 0m, 3, 0m, 2500m, 15000m))).Value!;
        Assert.Equal(["Daily", "Monthly"], unitType.SupportedStayModes.ToArray());
        var hourlyType = store.UpsertUnitType(Bkk, new UpsertUnitTypeRequest(
            unitType.Id, "SUITE", unitType.Name, null, 48m, 1, ["Hourly", "Daily"], 450m, 4, 125m, 2500m, 15000m)).Value!;
        var reloaded = store.GetPropertyHierarchy(Bkk).Value!.UnitTypes.Single(t => t.Id == unitType.Id);
        Assert.Equal((450m, 4, 125m), (hourlyType.HourlyBasePackagePrice, hourlyType.HourlyBasePackageHours, hourlyType.HourlyAdditionalHourPrice));
        Assert.Equal((450m, 4, 125m), (reloaded.HourlyBasePackagePrice, reloaded.HourlyBasePackageHours, reloaded.HourlyAdditionalHourPrice));
        var unit = store.UpsertUnitMaster(Bkk, new UpsertUnitMasterRequest(null, building.Id, floor.Id, unitType.Id, "B-101", ["Daily"], "Clean",
            [new UpsertUnitAssetItemDto("TV-01", new LocalizedTextDto("ทีวี", "TV"), 9000m)])).Value!;
        Assert.Single(new GetAdminUnitHandler(store, manage).Handle(new GetAdminUnitQuery(Bkk, unit.Id)).Value!.Assets);
        Assert.Equal("Building B+", store.UpsertBuilding(Bkk, new UpsertBuildingRequest(building.Id, "BLD-B", new LocalizedTextDto("อาคาร B+", "Building B+"))).Value!.Name.En);

        Assert.Equal(DomainErrorCodes.MasterDataInUse, store.DeleteBuilding(Bkk, building.Id).Error!.Code);
        Assert.Equal(DomainErrorCodes.MasterDataInUse, store.DeleteFloor(Bkk, floor.Id).Error!.Code);
        Assert.Equal(DomainErrorCodes.MasterDataInUse, store.DeleteUnitType(Bkk, unitType.Id).Error!.Code);
        var inUse = new DeleteAdminUnitHandler(store, manage, store).Handle(new DeleteAdminUnitCommand(Bkk, PmsSeedConstants.OccupiedMonthlyUnitA201Id));
        Assert.Equal(DomainErrorCodes.MasterDataInUse, inUse.Error!.Code);
        Assert.Contains("leases", inUse.Error.Message, StringComparison.Ordinal);
        Assert.True(new DeleteAdminUnitHandler(store, manage, store).Handle(new DeleteAdminUnitCommand(Bkk, unit.Id)).IsSuccess);
        Assert.True(new DeleteAdminFloorHandler(store, manage, store).Handle(new DeleteAdminFloorCommand(Bkk, floor.Id)).IsSuccess);
        Assert.True(new DeleteAdminBuildingHandler(store, manage, store).Handle(new DeleteAdminBuildingCommand(Bkk, building.Id)).IsSuccess);
        Assert.True(new DeleteAdminUnitTypeHandler(store, manage, store).Handle(new DeleteAdminUnitTypeCommand(Bkk, unitType.Id)).IsSuccess);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminPropertiesManage && e.Reason.StartsWith("Deleted unused unit", StringComparison.Ordinal));
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminUnitHandler(store, Admin("cnx", [Cnx], PermissionKeys.AdminPropertiesRead))
            .Handle(new GetAdminUnitQuery(Bkk, PmsSeedConstants.CleanUnitA101Id)).Error!.Code);

        Assert.Equal("MONTHLY_ROOM_RENT", new GetAdminTaxProfileHandler(store, manage)
            .Handle(new GetAdminTaxProfileQuery(Bkk, PmsSeedConstants.MonthlyRentExemptTaxProfileId)).Value!.ChargeCategoryCode);
        Assert.Equal(DomainErrorCodes.MasterDataInUse, store.DeleteTaxProfile(Bkk, PmsSeedConstants.MonthlyRentExemptTaxProfileId).Error!.Code);
        var custom = store.UpsertTaxProfile(Bkk, new UpsertTaxProfileRequest(null, "PARKING", new LocalizedTextDto("ที่จอดรถ"), "VatIncluded", 7m, 0m, true)).Value!;
        Assert.True(new DeleteAdminTaxProfileHandler(store, manage, store).Handle(new DeleteAdminTaxProfileCommand(Bkk, custom.Id)).IsSuccess);
        Assert.Equal(DomainErrorCodes.MasterDataInUse, store.DeleteUtilityTariff(Bkk, PmsSeedConstants.BkkWaterTariffId).Error!.Code); // A-201 lease is billed with it
        Assert.Equal("Water", store.GetUtilityTariff(Bkk, PmsSeedConstants.BkkWaterTariffId).Value!.UtilityType);
        Assert.Equal(DomainErrorCodes.MasterDataInUse, store.DeleteRatePlan(Bkk, PmsSeedConstants.StandardRatePlanId).Error!.Code); // live holds on its unit type
        Assert.Equal(DomainErrorCodes.PermissionDenied, new DeleteAdminRatePlanHandler(store, BkkAdmin(PermissionKeys.AdminPropertiesRead), store)
            .Handle(new DeleteAdminRatePlanCommand(Bkk, PmsSeedConstants.StandardRatePlanId)).Error!.Code);
    }

    [Fact]
    public void Reservation_Should_Be_Readable_Editable_With_Availability_And_Deletable_Only_When_Expired()
    {
        var store = new InMemoryOperationalService();
        var desk = BkkAdmin(PermissionKeys.AdminReservationsRead, PermissionKeys.AdminReservationsManage);
        var confirmed = new GetAdminReservationHandler(store, desk).Handle(new GetAdminReservationQuery(Bkk, PmsSeedConstants.SampleConfirmedReservationId)).Value!;
        var moved = new UpdateAdminReservationHandler(store, desk, store).Handle(new UpdateAdminReservationCommand(Bkk, confirmed.Id, new UpdateReservationRequest(
            confirmed.UnitType.Id, confirmed.AssignedUnit!.Id, confirmed.SlotStartAt.AddDays(1), confirmed.SlotEndAt.AddDays(1), 2, "Late arrival")));
        Assert.True(moved.IsSuccess, moved.Error?.Message);
        Assert.Equal(2, moved.Value!.GuestCount);
        Assert.Equal("Late arrival", moved.Value.Note);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminReservation(Bkk, confirmed.Id, new UpdateReservationRequest(
            confirmed.UnitType.Id, null, confirmed.SlotEndAt, confirmed.SlotStartAt)).Error!.Code);

        var holdId = PmsSeedConstants.SampleHoldReservationId;
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.DeleteAdminReservation(Bkk, holdId).Error!.Code); // live Hold: cancel instead
        var deleted = store.DeleteAdminReservation(Bkk, holdId, DateTimeOffset.UtcNow.AddHours(1)); // the 15-minute hold has expired by then
        Assert.Equal("Expired", deleted.Value!.Status);
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.GetAdminReservation(Bkk, holdId).Error!.Code);
    }

    [Fact]
    public void Stay_Corrections_Should_Respect_Folio_State_Permissions_And_Reasons()
    {
        var store = new InMemoryOperationalService();
        var desk = BkkAdmin(PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminStayCheckOut, PermissionKeys.AdminCashierOperateShift);
        var shift = store.OpenAdminCashierShift(Bkk, desk.UserId, new OpenCashierShiftRequest(500m)).Value!;
        var idDoc = TestFiles.Admin(store, StoredFilePurpose.IdentityDocument, Bkk);
        Assert.Equal(DomainErrorCodes.ValidationFailed, new CheckInStayHandler(store, desk, store).Handle(new CheckInStayCommand(
            Bkk, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 0m,
            Occupants: [new CheckInOccupantInputDto("Guest", "THA", "1100700000009", true, null, "0810000000", "not-a-key")])).Error!.Code);
        var stay = new CheckInStayHandler(store, desk, store).Handle(new CheckInStayCommand(
            Bkk, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 300m,
            Occupants: [new CheckInOccupantInputDto("Guest One", "THA", "1100700000009", true, null, "0810000000", idDoc)])).Value!;

        var detail = new GetAdminStayHandler(store, desk).Handle(new GetAdminStayQuery(Bkk, stay.Id)).Value!;
        var primary = Assert.Single(detail.Occupants);
        Assert.Equal("0810000000", primary.PhoneNumber);
        Assert.Equal(idDoc, primary.IdentityDocumentFileKey);
        Assert.DoesNotContain("1100700000009", primary.MaskedIdentityNumber, StringComparison.Ordinal);

        var added = new AddAdminStayOccupantHandler(store, desk, store, store)
            .Handle(new AddAdminStayOccupantCommand(Bkk, stay.Id, new CheckInOccupantInputDto("Guest Two", "USA", "P1234567", false))).Value!;
        var second = added.Occupants.Single(o => o.FullName == "Guest Two");
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.DeleteAdminStayOccupant(Bkk, stay.Id, primary.Id).Error!.Code);
        var promoted = new UpdateAdminStayOccupantHandler(store, desk, store, store).Handle(new UpdateAdminStayOccupantCommand(
            Bkk, stay.Id, second.Id, new UpdateStayOccupantRequest("Guest Two", "USA", null, true))).Value!;
        Assert.True(promoted.Occupants.Single(o => o.Id == second.Id).IsPrimaryOccupant);
        Assert.Single(new DeleteAdminStayOccupantHandler(store, desk, store).Handle(new DeleteAdminStayOccupantCommand(Bkk, stay.Id, primary.Id)).Value!.Occupants);

        var expected = detail.ExpectedCheckOutAt!.Value;
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.UpdateAdminStay(Bkk, stay.Id, new UpdateStayRequest(expected.AddHours(2), null)).Error!.Code);
        var edited = new UpdateAdminStayHandler(store, desk, store).Handle(new UpdateAdminStayCommand(Bkk, stay.Id, new UpdateStayRequest(expected.AddMinutes(-30), "VIP"))).Value!;
        Assert.Equal("VIP", edited.Note);
        Assert.Equal(expected.AddMinutes(-30), edited.ExpectedCheckOutAt);

        // Minibar charge paid in cash cannot be voided until the cash payment is reversed (AdminInvoicesVoid).
        var withMinibar = store.AddAdminFolioCharge(Bkk, stay.Id, new AddFolioChargeRequest(new LocalizedTextDto("มินิบาร์", "Minibar"), 100m, "VatIncluded")).Value!;
        var minibar = withMinibar.Folio.Charges.Single(c => c.Description.En == "Minibar");
        Assert.True(new RecordAdminFolioPaymentHandler(store, desk, store)
            .Handle(new RecordAdminFolioPaymentCommand(Bkk, stay.Id, new RecordFolioPaymentRequest(withMinibar.Folio.BalanceDue, "Cash"))).IsSuccess);
        Assert.Equal(DomainErrorCodes.StayFolioUnsettled, store.VoidAdminFolioCharge(Bkk, stay.Id, minibar.Id, new ReasonRequest("Not consumed")).Error!.Code);
        Assert.Equal(DomainErrorCodes.PermissionDenied, new ReverseAdminFolioPaymentHandler(store, desk, store)
            .Handle(new ReverseAdminFolioPaymentCommand(Bkk, stay.Id, new ReverseFolioPaymentRequest(100m, "Cash", "Wrong amount"))).Error!.Code);
        var supervisor = BkkAdmin(PermissionKeys.AdminInvoicesVoid, PermissionKeys.AdminStayCheckOut);
        var receiptsBefore = store.GetAdminCashierShift(Bkk, shift.Id).Value!.CashReceiptsInShift;
        Assert.True(new ReverseAdminFolioPaymentHandler(store, supervisor, store)
            .Handle(new ReverseAdminFolioPaymentCommand(Bkk, stay.Id, new ReverseFolioPaymentRequest(100m, "Cash", "Minibar not consumed"))).IsSuccess);
        Assert.Equal(receiptsBefore - 100m, store.GetAdminCashierShift(Bkk, shift.Id).Value!.CashReceiptsInShift);
        var voided = new VoidAdminFolioChargeHandler(store, desk, store).Handle(new VoidAdminFolioChargeCommand(Bkk, stay.Id, minibar.Id, new ReasonRequest("Not consumed"))).Value!;
        Assert.True(voided.Folio.Charges.Single(c => c.Id == minibar.Id).IsVoided);
        Assert.Equal(0m, voided.Folio.BalanceDue);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminInvoicesVoid && e.Reason == "Minibar not consumed");
        Assert.Equal(DomainErrorCodes.ValidationFailed, store.CancelAdminStay(Bkk, stay.Id, new ReasonRequest("x")).Error!.Code); // has a payment
    }

    [Fact]
    public void Cancel_Mistaken_CheckIn_Should_Refund_Key_Deposit_And_Free_The_Unit()
    {
        var store = new InMemoryOperationalService();
        var desk = BkkAdmin(PermissionKeys.AdminStayCheckIn, PermissionKeys.AdminCashierOperateShift);
        var shift = store.OpenAdminCashierShift(Bkk, desk.UserId, new OpenCashierShiftRequest(0m)).Value!;
        var stay = new CheckInStayHandler(store, desk, store).Handle(new CheckInStayCommand(
            Bkk, PmsSeedConstants.CleanUnitA101Id, PmsSeedConstants.PrimaryCustomerId, "Hourly", 300m)).Value!;
        var cancel = new CancelAdminStayHandler(store, desk, store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, cancel.Handle(new CancelAdminStayCommand(Bkk, stay.Id, new ReasonRequest(""))).Error!.Code);
        var cancelled = cancel.Handle(new CancelAdminStayCommand(Bkk, stay.Id, new ReasonRequest("Wrong room keyed"))).Value!;
        Assert.Equal("Cancelled", cancelled.Status);
        Assert.Equal("Wrong room keyed", cancelled.CancelReason);
        Assert.Equal(0m, cancelled.KeyDepositBalance);
        Assert.Equal(300m, store.GetAdminCashierShift(Bkk, shift.Id).Value!.CashDepositsRefundedInShift);
        Assert.Equal("Vacant", store.GetUnitMaster(Bkk, PmsSeedConstants.CleanUnitA101Id).Value!.OccupancyStatus);
    }

    [Fact]
    public void InMemory_Should_Stamp_UpdatedAt_So_MovedOut_Lease_Occupancy_Matches_EfCore()
    {
        var store = new InMemoryOperationalService();
        var today = AnalyticsPeriod.Today();
        var lease = store.CreateAdminLease(Bkk, new CreateLeaseRequest(
            PmsSeedConstants.DirtyUnitA102Id, PmsSeedConstants.SecondaryCustomerId, today.AddDays(-10), today.AddDays(300), 6000m, 0m, 0m, 0m)).Value!;
        Assert.True(store.GiveAdminLeaseMoveOutNotice(Bkk, lease.Id).IsSuccess);
        Assert.True(store.SettleAdminLeaseMoveOut(Bkk, lease.Id, new SettleLeaseMoveOutRequest(0m, 0m, "Moved out early")).IsSuccess);

        // MovedOut lease counts through its move-out date (UpdatedAt = now): 11 nights, plus 11 for the A-201 lease.
        var occupancy = store.GetOccupancyReport(Bkk, today.AddDays(-10), today).Value!;
        Assert.Equal(22, occupancy.ByStayMode.Single(m => m.StayMode == "Monthly").OccupiedUnitNights);
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
