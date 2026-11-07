using Microsoft.Extensions.Logging;
using TanPms.Application.Common.Abstractions;
using TanPms.Domain.Common;

namespace TanPms.Infrastructure.Services;

public sealed class EfCoreNotificationSender : INotificationSender
{
    private readonly ILogger<EfCoreNotificationSender> _logger;

    public EfCoreNotificationSender(ILogger<EfCoreNotificationSender> logger)
    {
        _logger = logger;
    }

    public Task NotifyCustomerAsync(
        Guid customerId,
        string templateKey,
        IReadOnlyDictionary<string, string> parameters,
        CancellationToken cancellationToken = default)
    {
        var sanitized = AuditRedactor.RedactMap(parameters);
        var channel = sanitized.TryGetValue("channel", out var ch) ? ch : "InApp";
        _logger.LogInformation(
            "Dispatched customer notification template {TemplateKey} over {Channel} for CustomerId {CustomerId}",
            templateKey,
            channel,
            customerId);

        return Task.CompletedTask;
    }
}
