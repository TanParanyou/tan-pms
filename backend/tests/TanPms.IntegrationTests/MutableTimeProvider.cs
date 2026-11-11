namespace TanPms.IntegrationTests;

public sealed class MutableTimeProvider : TimeProvider
{
    public MutableTimeProvider(DateTimeOffset now)
    {
        Now = now;
    }

    public DateTimeOffset Now { get; set; }

    public override DateTimeOffset GetUtcNow() => Now;
}
