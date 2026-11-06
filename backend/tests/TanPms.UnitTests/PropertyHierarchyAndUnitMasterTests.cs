using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Properties;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;
using TanPms.Domain.Properties;
using TanPms.Infrastructure.Services;
using Xunit;

namespace TanPms.UnitTests;

public sealed class PropertyHierarchyAndUnitMasterTests
{
    [Theory]
    [InlineData("00000")]
    [InlineData("00001")]
    [InlineData("99999")]
    public void Property_ValidateTaxBranchCode_Should_Accept_Valid_FiveDigit_String(string branchCode)
    {
        var property = new Property
        {
            Code = "BKK01",
            Name = LocalizedText.Create("สาขา", "Branch"),
            TaxBranchCode = branchCode
        };

        property.ValidateTaxBranchCode();
        Assert.Equal(branchCode, property.TaxBranchCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("0001")]
    [InlineData("000001")]
    [InlineData("0000A")]
    public void Property_ValidateTaxBranchCode_Should_Throw_On_Invalid_BranchCode(string? branchCode)
    {
        var property = new Property
        {
            Code = "BKK01",
            Name = LocalizedText.Create("สาขา", "Branch"),
            TaxBranchCode = branchCode!
        };

        var ex = Assert.Throws<DomainRuleException>(() => property.ValidateTaxBranchCode());
        Assert.Equal(DomainErrorCodes.ValidationFailed, ex.ErrorCode);
    }

    [Fact]
    public void Unit_UpdateConfiguration_Should_Enforce_AtLeastOne_StayMode()
    {
        var unit = new Unit
        {
            PropertyId = Guid.NewGuid(),
            BuildingId = Guid.NewGuid(),
            FloorId = Guid.NewGuid(),
            UnitTypeId = Guid.NewGuid(),
            UnitNumber = "A-101"
        };

        var ex = Assert.Throws<DomainRuleException>(() =>
            unit.UpdateConfiguration([], ConditionStatus.Clean));

        Assert.Equal(DomainErrorCodes.ValidationFailed, ex.ErrorCode);
    }

    [Fact]
    public void Unit_ReplaceAssets_Should_Enforce_AssetCode_And_NonNegative_Cost()
    {
        var unit = new Unit
        {
            PropertyId = Guid.NewGuid(),
            BuildingId = Guid.NewGuid(),
            FloorId = Guid.NewGuid(),
            UnitTypeId = Guid.NewGuid(),
            UnitNumber = "A-101"
        };

        var invalidCodeAsset = new UnitAsset
        {
            PropertyId = unit.PropertyId,
            UnitId = unit.Id,
            AssetCode = "",
            Name = LocalizedText.Create("ทีวี", "TV"),
            ReplacementCostAmount = 1000m
        };

        var ex1 = Assert.Throws<DomainRuleException>(() => unit.ReplaceAssets([invalidCodeAsset]));
        Assert.Equal(DomainErrorCodes.ValidationFailed, ex1.ErrorCode);

        var negativeCostAsset = new UnitAsset
        {
            PropertyId = unit.PropertyId,
            UnitId = unit.Id,
            AssetCode = "AST-0001",
            Name = LocalizedText.Create("ทีวี", "TV"),
            ReplacementCostAmount = -10m
        };

        var ex2 = Assert.Throws<DomainRuleException>(() => unit.ReplaceAssets([negativeCostAsset]));
        Assert.Equal(DomainErrorCodes.ValidationFailed, ex2.ErrorCode);
    }

    [Fact]
    public void GetAdminPropertyHierarchy_Should_Enforce_Permissions_And_PropertyScope()
    {
        var store = new InMemoryOperationalService();

        var unauthorizedContext = new TestCurrentUserContext
        {
            IsAdminScope = true,
            Permissions = new HashSet<string> { "admin.rack.view" },
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId }
        };

        var handler1 = new GetAdminPropertyHierarchyHandler(store, unauthorizedContext);
        var result1 = handler1.Handle(new GetAdminPropertyHierarchyQuery(PmsSeedConstants.BkkPropertyId));
        Assert.True(result1.IsFailure);
        Assert.Equal(DomainErrorCodes.PermissionDenied, result1.Error.Code);

        var forbiddenPropertyContext = new TestCurrentUserContext
        {
            IsAdminScope = true,
            Permissions = new HashSet<string> { PermissionKeys.AdminPropertiesRead },
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId }
        };

        var handler2 = new GetAdminPropertyHierarchyHandler(store, forbiddenPropertyContext);
        var result2 = handler2.Handle(new GetAdminPropertyHierarchyQuery(PmsSeedConstants.CnxPropertyId));
        Assert.True(result2.IsFailure);
        Assert.Equal(DomainErrorCodes.PropertyScopeDenied, result2.Error.Code);

        var validContext = new TestCurrentUserContext
        {
            IsAdminScope = true,
            Permissions = new HashSet<string> { PermissionKeys.AdminPropertiesRead },
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId }
        };

        var handler3 = new GetAdminPropertyHierarchyHandler(store, validContext);
        var result3 = handler3.Handle(new GetAdminPropertyHierarchyQuery(PmsSeedConstants.BkkPropertyId));
        Assert.True(result3.IsSuccess);
        Assert.NotNull(result3.Value);
        Assert.Equal("BKK01", result3.Value.Property.Code);
        Assert.NotEmpty(result3.Value.Buildings);
        Assert.NotEmpty(result3.Value.UnitTypes);
        Assert.NotEmpty(result3.Value.Units);
    }

    [Fact]
    public void UpsertAdminUnitMaster_Should_Create_Or_Update_Unit_And_Assets_With_Audit()
    {
        var store = new InMemoryOperationalService();
        var adminContext = new TestCurrentUserContext
        {
            IsAdminScope = true,
            Permissions = new HashSet<string> { PermissionKeys.AdminPropertiesManage },
            AllowedPropertyIds = new HashSet<Guid> { PmsSeedConstants.BkkPropertyId }
        };

        var handler = new UpsertAdminUnitMasterHandler(store, adminContext, store);

        var request = new UpsertUnitMasterRequest(
            Id: null,
            BuildingId: PmsSeedConstants.BkkBuildingAId,
            FloorId: PmsSeedConstants.BkkFloor1Id,
            UnitTypeId: PmsSeedConstants.StandardUnitTypeId,
            UnitNumber: "A-199",
            SupportedStayModes: ["Hourly", "Daily"],
            ConditionStatus: "Clean",
            Assets:
            [
                new UpsertUnitAssetItemDto(
                    "AST-NEW-01",
                    new LocalizedTextDto("สมาร์ททีวี 50 นิ้ว", "50-inch Smart TV"),
                    15000m)
            ]);

        var result = handler.Handle(new UpsertAdminUnitMasterCommand(PmsSeedConstants.BkkPropertyId, request));
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("A-199", result.Value.UnitNumber);
        Assert.Single(result.Value.Assets);
        Assert.Equal("AST-NEW-01", result.Value.Assets[0].AssetCode);

        // Check audit event
        var audit = store.AuditEvents.FirstOrDefault(a => a.Reason.Contains("A-199"));
        Assert.NotNull(audit);
        Assert.Equal(PermissionKeys.AdminPropertiesManage, audit.ActionKey);
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
