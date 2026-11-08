namespace TanPms.Application.Billing;

// TaxProfile.ChargeCategoryCode values used for utility invoice lines; Exempt when no active profile exists.
public static class UtilityChargeCategories
{
    public const string MonthlyRoomRent = "MONTHLY_ROOM_RENT";
    public const string Water = "UTILITY_WATER";
    public const string Electric = "UTILITY_ELECTRIC";
    public const string ShortStayRoom = "SHORT_STAY_ROOM";
}
