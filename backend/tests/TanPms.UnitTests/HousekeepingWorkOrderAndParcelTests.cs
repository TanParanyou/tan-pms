using TanPms.Application.Common.Abstractions;
using TanPms.Application.Housekeeping;
using TanPms.Application.Parcels;
using TanPms.Application.Stays;
using TanPms.Application.WorkOrders;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class HousekeepingWorkOrderAndParcelTests
{
    private static readonly Guid Bkk = PmsSeedConstants.BkkPropertyId;
    private static readonly Guid A101 = PmsSeedConstants.CleanUnitA101Id;
    private static readonly Guid A201 = PmsSeedConstants.OccupiedMonthlyUnitA201Id;

    private static TestCurrentUserContext Admin(params string[] permissions) => new()
    {
        UserId = "ops-admin",
        IsAdminScope = true,
        AllowedPropertyIds = new HashSet<Guid> { Bkk },
        Permissions = new HashSet<string>(permissions)
    };

    private static TestCurrentUserContext Client(Guid customerId) => new()
    {
        UserId = $"client-{customerId:N}",
        IsClientScope = true,
        CustomerId = customerId
    };

    private static StaySummaryDto CheckInA101(InMemoryOperationalService store) =>
        store.CheckInStay(
            new CheckInStayCommand(Bkk, A101, PmsSeedConstants.SecondaryCustomerId, "Hourly", 0m),
            callerHasOverridePermission: false).Value!;

    [Fact]
    public void Housekeeping_Task_Should_Move_Pending_Cleaning_Inspecting_Completed_And_Mark_Unit_Clean()
    {
        var store = new InMemoryOperationalService();
        var stay = CheckInA101(store);
        Assert.True(store.RecordAdminFolioPayment(Bkk, stay.Id, new RecordFolioPaymentRequest(500m, "Cash")).IsSuccess);
        Assert.True(store.CheckOutAdminStay(Bkk, stay.Id, new CheckOutStayRequest(0m, "Done")).IsSuccess);

        var housekeeper = Admin(PermissionKeys.AdminHousekeepingUpdate);
        var task = Assert.Single(new GetAdminHousekeepingTasksHandler(store, housekeeper)
            .Handle(new GetAdminHousekeepingTasksQuery(Bkk, "Pending", null)).Value!.Items);
        Assert.Equal("A-101", task.Unit.UnitNumber);
        Assert.Equal(stay.DocumentNumber, task.SourceDocumentNumber);
        Assert.Equal("Dirty", task.UnitConditionStatus);

        var assigned = new AssignAdminHousekeepingTaskHandler(store, housekeeper, store)
            .Handle(new AssignAdminHousekeepingTaskCommand(Bkk, task.Id, new AssignHousekeepingTaskRequest("maid-01")));
        Assert.Equal("maid-01", assigned.Value!.AssignedStaffUserId);

        var complete = new CompleteAdminHousekeepingTaskHandler(store, housekeeper, store);
        Assert.Equal(DomainErrorCodes.ValidationFailed, complete
            .Handle(new CompleteAdminHousekeepingTaskCommand(Bkk, task.Id, new CompleteHousekeepingTaskRequest())).Error!.Code);

        var start = new StartAdminHousekeepingTaskHandler(store, housekeeper, store);
        var cleaning = start.Handle(new StartAdminHousekeepingTaskCommand(Bkk, task.Id));
        Assert.Equal("Cleaning", cleaning.Value!.Status);
        Assert.Equal("Cleaning", cleaning.Value.UnitConditionStatus);
        Assert.Equal(DomainErrorCodes.ValidationFailed, start.Handle(new StartAdminHousekeepingTaskCommand(Bkk, task.Id)).Error!.Code);

        var inspecting = complete.Handle(new CompleteAdminHousekeepingTaskCommand(Bkk, task.Id, new CompleteHousekeepingTaskRequest()));
        Assert.Equal("Inspecting", inspecting.Value!.Status);
        var done = complete.Handle(new CompleteAdminHousekeepingTaskCommand(Bkk, task.Id, new CompleteHousekeepingTaskRequest()));
        Assert.Equal("Completed", done.Value!.Status);
        Assert.Equal("Clean", done.Value.UnitConditionStatus);
        Assert.Contains(store.AuditEvents, e => e.ActionKey == PermissionKeys.AdminHousekeepingUpdate && e.EntityId == task.Id);

        // Unit is Clean again, so a normal check-in (no dirty override) succeeds.
        Assert.True(store.CheckInStay(new CheckInStayCommand(Bkk, A101, PmsSeedConstants.PrimaryCustomerId, "Hourly", 0m), false).IsSuccess);
    }

    [Fact]
    public void WorkOrder_Should_Enforce_Transitions_And_Charge_Repair_To_Active_Stay_Folio()
    {
        var store = new InMemoryOperationalService();
        var stay = CheckInA101(store);
        var manager = Admin(PermissionKeys.AdminWorkOrdersManage);

        var created = new CreateAdminWorkOrderHandler(store, manager, store)
            .Handle(new CreateAdminWorkOrderCommand(Bkk, new CreateWorkOrderRequest(A101, "Broken lamp", "Bedside lamp shattered", "High", "wo/before.jpg")));
        Assert.True(created.IsSuccess, created.Error?.Message);
        Assert.StartsWith("BKK01-WKO-", created.Value!.DocumentNumber, StringComparison.Ordinal);
        Assert.Equal("Open", created.Value.Status);
        Assert.Equal("High", created.Value.Priority);

        var resolver = new ResolveAdminWorkOrderHandler(store, manager, store);
        var tooEarly = resolver.Handle(new ResolveAdminWorkOrderCommand(Bkk, created.Value.Id, new ResolveWorkOrderRequest("Replaced lamp")));
        Assert.Equal(DomainErrorCodes.ValidationFailed, tooEarly.Error!.Code);

        var assigned = new AssignAdminWorkOrderHandler(store, manager, store)
            .Handle(new AssignAdminWorkOrderCommand(Bkk, created.Value.Id, new AssignWorkOrderRequest("tech-07")));
        Assert.Equal("InProgress", assigned.Value!.Status);

        Assert.Equal(DomainErrorCodes.ValidationFailed, resolver
            .Handle(new ResolveAdminWorkOrderCommand(Bkk, created.Value.Id, new ResolveWorkOrderRequest("x", null, 0m, ChargeToTenant: true))).Error!.Code);

        var resolved = resolver.Handle(new ResolveAdminWorkOrderCommand(
            Bkk, created.Value.Id, new ResolveWorkOrderRequest("Replaced lamp", "wo/after.jpg", 350m, ChargeToTenant: true)));
        Assert.True(resolved.IsSuccess, resolved.Error?.Message);
        Assert.Equal("Completed", resolved.Value!.Status);
        Assert.Equal(stay.DocumentNumber, resolved.Value.ChargeDocumentNumber);
        Assert.Equal(350m, resolved.Value.TenantChargeAmount);
        Assert.Equal("wo/after.jpg", resolved.Value.AfterPhotoFileKey);

        var folio = store.GetAdminStays(Bkk, "Active", null).Value!.Items.Single(s => s.Id == stay.Id).Folio;
        Assert.Equal(850m, folio.TotalCharges); // 500 base package + 350 repair

        Assert.Equal(DomainErrorCodes.ValidationFailed, new AssignAdminWorkOrderHandler(store, manager, store)
            .Handle(new AssignAdminWorkOrderCommand(Bkk, created.Value.Id, new AssignWorkOrderRequest("tech-08"))).Error!.Code);
    }

    [Fact]
    public void Lease_Repair_Charge_Should_Create_Then_Append_To_Draft_Invoice_Never_The_Issued_One()
    {
        var store = new InMemoryOperationalService();
        var manager = Admin(PermissionKeys.AdminWorkOrdersManage);

        string Resolve(decimal cost)
        {
            var wo = store.CreateAdminWorkOrder(Bkk, new CreateWorkOrderRequest(A201, $"Repair {cost}")).Value!;
            store.AssignAdminWorkOrder(Bkk, wo.Id, new AssignWorkOrderRequest("tech"));
            var resolved = store.ResolveAdminWorkOrder(Bkk, wo.Id, new ResolveWorkOrderRequest("Fixed", null, cost, true));
            Assert.True(resolved.IsSuccess, resolved.Error?.Message);
            return resolved.Value!.ChargeDocumentNumber!;
        }

        var first = Resolve(1070m);
        var second = Resolve(214m);
        Assert.Equal(first, second);
        Assert.NotEqual("BKK01-INV-2611-0001", first); // seeded Issued invoice is immutable

        var draft = store.GetAdminInvoices(Bkk, null, "Draft").Value!.Items.Single(i => i.DocumentNumber == first);
        Assert.Equal(2, draft.Lines.Count);
        Assert.Equal(1284m, draft.TotalAmount);
        Assert.Equal(84m, draft.TotalVatAmount); // VatIncluded: 70 + 14
        Assert.Equal("A-201", draft.Unit!.UnitNumber);
    }

    [Fact]
    public void Client_WorkOrders_Should_Be_Limited_To_Own_Tenancy_And_Own_List()
    {
        var store = new InMemoryOperationalService();
        var customer1 = Client(PmsSeedConstants.PrimaryCustomerId); // tenant of A-201

        var own = new CreateClientWorkOrderHandler(store, customer1, store)
            .Handle(new CreateClientWorkOrderCommand(new CreateWorkOrderRequest(A201, "Leaking tap", null, null, "wo/tap.jpg")));
        Assert.True(own.IsSuccess, own.Error?.Message);
        Assert.Equal(PmsSeedConstants.PrimaryCustomerId, own.Value!.ReportedByCustomer!.Id);
        Assert.Equal("1-xxxx-xxxxx-12-3", own.Value.ReportedByCustomer.MaskedNationalId);

        var notTenant = new CreateClientWorkOrderHandler(store, customer1, store)
            .Handle(new CreateClientWorkOrderCommand(new CreateWorkOrderRequest(A101, "Not my room")));
        Assert.Equal(DomainErrorCodes.PermissionDenied, notTenant.Error!.Code);

        Assert.Single(new GetClientWorkOrdersHandler(store, customer1).Handle(new GetClientWorkOrdersQuery(null)).Value!.Items);
        Assert.Empty(new GetClientWorkOrdersHandler(store, Client(PmsSeedConstants.SecondaryCustomerId))
            .Handle(new GetClientWorkOrdersQuery(null)).Value!.Items);

        var otherProperty = new TestCurrentUserContext
        {
            IsAdminScope = true,
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.CnxPropertyId },
            Permissions = new HashSet<string>
            {
                PermissionKeys.AdminWorkOrdersManage, PermissionKeys.AdminParcelsManage, PermissionKeys.AdminHousekeepingUpdate
            }
        };
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminWorkOrdersHandler(store, otherProperty)
            .Handle(new GetAdminWorkOrdersQuery(Bkk, null)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminParcelsHandler(store, otherProperty)
            .Handle(new GetAdminParcelsQuery(Bkk, null)).Error!.Code);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, new GetAdminHousekeepingTasksHandler(store, otherProperty)
            .Handle(new GetAdminHousekeepingTasksQuery(Bkk, null, null)).Error!.Code);
    }

    [Fact]
    public void Parcel_Should_Resolve_Tenant_Notify_And_Be_Picked_Up_Once()
    {
        var store = new InMemoryOperationalService();
        var desk = Admin(PermissionKeys.AdminParcelsManage);
        var notificationsBefore = store.GetClientNotifications(PmsSeedConstants.PrimaryCustomerId).Value!.Items.Count;

        var received = new ReceiveAdminParcelHandler(store, desk, store, store)
            .Handle(new ReceiveAdminParcelCommand(Bkk, new ReceiveParcelRequest(A201, "Flash Express", "FLX-1", "parcels/box.jpg")));
        Assert.True(received.IsSuccess, received.Error?.Message);
        Assert.StartsWith("BKK01-PCL-", received.Value!.DocumentNumber, StringComparison.Ordinal);
        Assert.NotEqual("BKK01-PCL-2611-0001", received.Value.DocumentNumber); // seeded parcel number is reserved
        Assert.Equal(PmsSeedConstants.PrimaryCustomerId, received.Value.Customer.Id);
        Assert.Equal("1-xxxx-xxxxx-12-3", received.Value.Customer.MaskedNationalId);
        Assert.Equal(notificationsBefore + 1, store.GetClientNotifications(PmsSeedConstants.PrimaryCustomerId).Value!.Items.Count);

        var vacant = store.ReceiveAdminParcel(Bkk, new ReceiveParcelRequest(PmsSeedConstants.DirtyUnitA102Id, "Kerry"));
        Assert.Equal(DomainErrorCodes.ValidationFailed, vacant.Error!.Code);

        Assert.Contains(new GetClientParcelsHandler(store, Client(PmsSeedConstants.PrimaryCustomerId))
            .Handle(new GetClientParcelsQuery("Arrived")).Value!.Items, p => p.Id == received.Value.Id);
        Assert.DoesNotContain(new GetClientParcelsHandler(store, Client(PmsSeedConstants.SecondaryCustomerId))
            .Handle(new GetClientParcelsQuery(null)).Value!.Items, p => p.Id == received.Value.Id);

        var pickup = new PickUpAdminParcelHandler(store, desk, store);
        var picked = pickup.Handle(new PickUpAdminParcelCommand(Bkk, received.Value.Id, new PickUpParcelRequest("Somchai")));
        Assert.Equal("PickedUp", picked.Value!.Status);
        Assert.Equal("Somchai", picked.Value.RecipientName);
        Assert.Equal(DomainErrorCodes.ValidationFailed, pickup
            .Handle(new PickUpAdminParcelCommand(Bkk, received.Value.Id, new PickUpParcelRequest())).Error!.Code);
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
