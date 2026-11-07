using TanPms.Application.Common.Abstractions;
using TanPms.Domain.Common;
using TanPms.Infrastructure.Persistence;

namespace TanPms.Infrastructure.Services;

public sealed class EfCoreAuditLogger : IAuditLogger
{
    private readonly TanPmsDbContext _dbContext;

    public EfCoreAuditLogger(TanPmsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task RecordAsync(AuditEvent auditEvent, CancellationToken cancellationToken = default)
    {
        _dbContext.AuditEvents.Add(auditEvent);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
