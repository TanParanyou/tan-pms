using TanPms.Domain.DocumentNumbering;

namespace TanPms.Application.Common.Abstractions;

public interface IDocumentNumberService
{
    Task<string> NextDocumentNumberAsync(
        Guid propertyId,
        string propertyCode,
        DocumentTypeCode documentType,
        DateTimeOffset issuedAtUtc,
        CancellationToken cancellationToken = default);
}
