using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Leases;

public sealed class GetAdminLeaseContractPdfHandler
{
    private readonly ILeaseStore _store;
    private readonly IPdfDocumentRenderer _renderer;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public GetAdminLeaseContractPdfHandler(ILeaseStore store, IPdfDocumentRenderer renderer, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _renderer = renderer;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<PdfDocumentDto> Handle(GetAdminLeaseContractPdfQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminLeasesManage) is { } authError)
        {
            return Result<PdfDocumentDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        var contract = _store.GetAdminLeaseContract(query.PropertyId, query.LeaseId, unmaskPii);
        if (contract.IsFailure || contract.Value is null)
        {
            return Result<PdfDocumentDto>.Failure(contract.Error!);
        }

        var pdf = new PdfDocumentDto($"{contract.Value.Lease.DocumentNumber}.pdf", _renderer.RenderLeaseContract(contract.Value));
        _auditLogger.RecordMutation(
            propertyId: query.PropertyId,
            actionKey: PermissionKeys.AdminLeasesManage,
            entityId: contract.Value.Lease.Id,
            reason: $"Printed lease contract {contract.Value.Lease.DocumentNumber}",
            afterState: new { contract.Value.Lease.DocumentNumber, Printed = true, UnmaskedPii = unmaskPii });
        return Result<PdfDocumentDto>.Success(pdf);
    }
}
