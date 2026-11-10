using TanPms.Application.Billing;

namespace TanPms.WebApi.Background;

// Simplest robust option for the Overdue transition: one idempotent sweep at startup and then every
// Billing:OverdueSweepIntervalMinutes (default 60). Each run uses a fresh scope (EF stores are scoped) and never
// crashes the host: a failed run (e.g. database not migrated yet) is logged and retried on the next tick.
public sealed class OverdueInvoiceSweeper : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OverdueInvoiceSweeper> _logger;
    private readonly TimeSpan _interval;

    public OverdueInvoiceSweeper(IServiceScopeFactory scopeFactory, IConfiguration configuration, ILogger<OverdueInvoiceSweeper> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _interval = TimeSpan.FromMinutes(Math.Max(1, configuration.GetValue("Billing:OverdueSweepIntervalMinutes", 60)));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);
        do
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var flipped = scope.ServiceProvider.GetRequiredService<IBillingStore>().MarkOverdueInvoices(DateTimeOffset.UtcNow);
                if (flipped > 0)
                {
                    _logger.LogInformation("Marked {Count} invoice(s) Overdue.", flipped);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Overdue invoice sweep failed; retrying on the next interval.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
