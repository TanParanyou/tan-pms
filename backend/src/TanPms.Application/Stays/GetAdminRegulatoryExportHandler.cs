using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class GetAdminRegulatoryExportHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public GetAdminRegulatoryExportHandler(
        IStayStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<RegulatoryExportResponse> Handle(GetAdminRegulatoryExportQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminRegulatoryExport) is { } authError)
        {
            return Result<RegulatoryExportResponse>.Failure(authError);
        }

        if (query.UnmaskPii
            && ScopeAuthorizationGuard.CheckAdminPermission(_currentUser, PermissionKeys.AdminCustomerUnmaskPii) is { } piiError)
        {
            return Result<RegulatoryExportResponse>.Failure(piiError);
        }

        var result = _store.GetAdminRegulatoryExport(query.PropertyId, query.ReportType, query.UnmaskPii);
        if (result.IsSuccess && result.Value is not null && query.UnmaskPii)
        {
            _auditLogger.RecordMutation(
                propertyId: query.PropertyId,
                actionKey: PermissionKeys.AdminCustomerUnmaskPii,
                entityId: query.PropertyId,
                reason: $"Exported unmasked regulatory report {result.Value.ReportType} ({result.Value.Rows.Count} rows)",
                afterState: new
                {
                    result.Value.ReportType,
                    UnmaskPii = true,
                    RowCount = result.Value.Rows.Count
                });
        }

        return result;
    }
}
