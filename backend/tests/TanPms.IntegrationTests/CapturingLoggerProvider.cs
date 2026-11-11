using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace TanPms.IntegrationTests;

// Collects every formatted log line (plus exception text) so tests can prove secrets never reach logs.
public sealed class CapturingLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<string> _lines = new();

    public IReadOnlyCollection<string> Lines => _lines.ToArray();

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(_lines, categoryName);

    public void Dispose()
    {
    }

    private sealed class CapturingLogger(ConcurrentQueue<string> lines, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            lines.Enqueue($"{category}: {formatter(state, exception)} {exception}");
    }
}
