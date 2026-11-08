using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class GetAdminReceiptPdfHandler
{
    private readonly IReceiptStore _store;
    private readonly IPdfDocumentRenderer _renderer;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminReceiptPdfHandler(IReceiptStore store, IPdfDocumentRenderer renderer, ICurrentUserContext currentUser)
    {
        _store = store;
        _renderer = renderer;
        _currentUser = currentUser;
    }

    public Result<PdfDocumentDto> Handle(GetAdminReceiptPdfQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            ReceiptRules.AdminReadPermissions) is { } authError)
        {
            return Result<PdfDocumentDto>.Failure(authError);
        }

        var unmaskPii = _currentUser.Permissions.Contains(PermissionKeys.AdminCustomerUnmaskPii);
        var document = _store.GetAdminReceiptDocument(query.PropertyId, query.ReceiptId, unmaskPii);
        return document.IsFailure || document.Value is null
            ? Result<PdfDocumentDto>.Failure(document.Error!)
            : Result<PdfDocumentDto>.Success(new PdfDocumentDto(
                $"{document.Value.Receipt.DocumentNumber}.pdf",
                _renderer.RenderReceipt(document.Value)));
    }
}
