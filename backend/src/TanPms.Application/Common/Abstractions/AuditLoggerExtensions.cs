using System.Text.Json;
using TanPms.Domain.Common;

namespace TanPms.Application.Common.Abstractions;

public static class AuditLoggerExtensions
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static void RecordMutation<TAfterState>(
        this IAuditLogger auditLogger,
        Guid propertyId,
        string actionKey,
        Guid entityId,
        string reason,
        TAfterState afterState,
        object? beforeState = null)
    {
        auditLogger.RecordAsync(new AuditEvent
        {
            PropertyId = propertyId,
            ActionKey = actionKey,
            EntityId = entityId,
            Reason = reason,
            BeforeStateJson = beforeState is not null
                ? AuditRedactor.RedactJson(JsonSerializer.Serialize(beforeState, JsonOptions))
                : null,
            AfterStateJson = AuditRedactor.RedactJson(JsonSerializer.Serialize(afterState, JsonOptions))
        }).GetAwaiter().GetResult();
    }
}
