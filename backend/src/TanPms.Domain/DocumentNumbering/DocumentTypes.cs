namespace TanPms.Domain.DocumentNumbering;

public static class DocumentTypes
{
    public const string Reservation = "RES";
    public const string Stay = "STY";
    public const string Lease = "LSE";
    public const string Invoice = "INV";
    public const string Receipt = "RCT";
    public const string DepositTransaction = "DEP";
    public const string CashierShift = "SHF";
    public const string WorkOrder = "WKO";
    public const string Parcel = "PCL";

    public static readonly IReadOnlyList<string> AllPrefixes =
    [
        Reservation,
        Stay,
        Lease,
        Invoice,
        Receipt,
        DepositTransaction,
        CashierShift,
        WorkOrder,
        Parcel
    ];
}
