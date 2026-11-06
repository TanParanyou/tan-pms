using TanPms.Domain.Common;
using TanPms.Domain.Enums;
using TanPms.Domain.Exceptions;

namespace TanPms.Application.Abstractions;

public interface ICurrentUserContext
{
    string UserId { get; }
    bool IsAdminScope { get; }
    bool IsClientScope { get; }
    IReadOnlySet<Guid> AllowedPropertyIds { get; }
    IReadOnlySet<string> Permissions { get; }
    Guid? CustomerId { get; }
    bool HasOpenCashierShift { get; }

    void EnsureAdminPropertyAccess(Guid propertyId)
    {
        if (!IsAdminScope)
        {
            throw new DomainRuleException(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires AdminScope authorization.",
                httpStatus: 403);
        }

        if (!AllowedPropertyIds.Contains(propertyId))
        {
            throw new DomainRuleException(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{propertyId}'.",
                httpStatus: 403);
        }
    }

    void EnsureAdminPermission(string permissionKey)
    {
        if (!IsAdminScope || !Permissions.Contains(permissionKey))
        {
            throw new DomainRuleException(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{permissionKey}'.",
                httpStatus: 403);
        }
    }

    Guid RequireClientCustomerId()
    {
        if (!IsClientScope || CustomerId is null || CustomerId == Guid.Empty)
        {
            throw new DomainRuleException(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope with a bound CustomerId.",
                httpStatus: 403);
        }

        return CustomerId.Value;
    }
}

public interface IDocumentNumberService
{
    Task<string> NextDocumentNumberAsync(
        Guid propertyId,
        string propertyCode,
        DocumentTypeCode documentType,
        DateTimeOffset issuedAtUtc,
        CancellationToken cancellationToken = default);
}

public interface IFileStorage
{
    Task<string> UploadAsync(
        string objectKeyPrefix,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default);
}

public interface INotificationSender
{
    Task NotifyCustomerAsync(
        Guid customerId,
        string templateKey,
        IReadOnlyDictionary<string, string> parameters,
        CancellationToken cancellationToken = default);
}

public interface IAuditLogger
{
    Task RecordAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default);
}
