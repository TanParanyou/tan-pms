namespace TanPms.Application.Common.Abstractions;

public interface INotificationSender
{
    Task NotifyCustomerAsync(
        Guid customerId,
        string templateKey,
        IReadOnlyDictionary<string, string> parameters,
        CancellationToken cancellationToken = default);
}
