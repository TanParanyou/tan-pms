namespace TanPms.Application.Stays;

public sealed record GetAdminRegulatoryExportQuery(
    Guid PropertyId,
    string ReportType,
    bool UnmaskPii = false);
