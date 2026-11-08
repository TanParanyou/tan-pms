namespace TanPms.Application.Analytics;

public sealed record AgingBucketsDto(
    decimal Current,
    decimal Days1To30,
    decimal Days31To60,
    decimal Days61To90,
    decimal Days90Plus,
    decimal Total);
