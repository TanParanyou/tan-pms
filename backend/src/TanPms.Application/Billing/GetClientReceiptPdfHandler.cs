using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Billing;

public sealed class GetClientReceiptPdfHandler
{
    private readonly IReceiptStore _store;
    private readonly IPdfDocumentRenderer _renderer;
    private readonly ICurrentUserContext _currentUser;

    public GetClientReceiptPdfHandler(IReceiptStore store, IPdfDocumentRenderer renderer, ICurrentUserContext currentUser)
    {
        _store = store;
        _renderer = renderer;
        _currentUser = currentUser;
    }

    public Result<PdfDocumentDto> Handle(GetClientReceiptPdfQuery query)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<PdfDocumentDto>.Failure(authError);
        }

        var document = _store.GetClientReceiptDocument(customerId, query.ReceiptId);
        return document.IsFailure || document.Value is null
            ? Result<PdfDocumentDto>.Failure(document.Error!)
            : Result<PdfDocumentDto>.Success(new PdfDocumentDto(
                $"{document.Value.Receipt.DocumentNumber}.pdf",
                _renderer.RenderReceipt(document.Value)));
    }
}
