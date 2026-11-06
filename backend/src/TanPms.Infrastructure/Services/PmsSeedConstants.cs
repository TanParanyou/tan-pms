namespace TanPms.Infrastructure.Services;

public static class PmsSeedConstants
{
    public static readonly Guid BkkPropertyId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid CnxPropertyId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public static readonly Guid BkkBuildingAId = Guid.Parse("11111111-aaaa-1111-1111-111111111111");
    public static readonly Guid BkkFloor1Id = Guid.Parse("11111111-f001-1111-1111-111111111111");
    public static readonly Guid BkkFloor2Id = Guid.Parse("11111111-f002-1111-1111-111111111111");
    public static readonly Guid StandardUnitTypeId = Guid.Parse("11111111-cccc-1111-1111-111111111101");
    public static readonly Guid DeluxeUnitTypeId = Guid.Parse("11111111-cccc-1111-1111-111111111102");

    public static readonly Guid CleanUnitA101Id = Guid.Parse("33333333-3333-3333-3333-333333333301");
    public static readonly Guid DirtyUnitA102Id = Guid.Parse("33333333-3333-3333-3333-333333333302");
    public static readonly Guid OccupiedMonthlyUnitA201Id = Guid.Parse("33333333-3333-3333-3333-333333333303");

    public static readonly Guid PrimaryCustomerId = Guid.Parse("44444444-4444-4444-4444-444444444401");
    public static readonly Guid SecondaryCustomerId = Guid.Parse("44444444-4444-4444-4444-444444444402");
}
