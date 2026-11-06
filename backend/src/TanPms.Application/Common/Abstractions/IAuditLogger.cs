using TanPms.Domain.Common;

namespace TanPms.Application.Common.Abstractions;

public interface IAuditLogger
{
    Task RecordAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default);
}
