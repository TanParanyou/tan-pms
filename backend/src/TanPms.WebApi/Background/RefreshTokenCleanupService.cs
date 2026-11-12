using TanPms.Application.Identity;

namespace TanPms.WebApi.Background;

// Same pattern as OverdueInvoiceSweeper: one idempotent run at startup, then every Auth:Jwt:CleanupIntervalMinutes
// (default 60), fresh scope per run, failures logged and retried on the next tick.
public sealed class RefreshTokenCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RefreshTokenCleanupService> _logger;
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _interval;
    private readonly TimeSpan _retention;

    public RefreshTokenCleanupService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        AuthSecuritySettings settings,
        TimeProvider timeProvider,
        ILogger<RefreshTokenCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _timeProvider = timeProvider;
        _interval = TimeSpan.FromMinutes(Math.Max(1, configuration.GetValue("Auth:Jwt:CleanupIntervalMinutes", 60)));
        _retention = TimeSpan.FromDays(settings.RefreshTokenRetentionDays);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);
        do
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var deleted = scope.ServiceProvider.GetRequiredService<IAuthStore>()
                    .DeleteStaleRefreshTokens(_timeProvider.GetUtcNow(), _retention);
                if (deleted > 0)
                {
                    _logger.LogInformation("Deleted {Count} stale refresh token(s).", deleted);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Refresh token cleanup failed; retrying on the next interval.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
