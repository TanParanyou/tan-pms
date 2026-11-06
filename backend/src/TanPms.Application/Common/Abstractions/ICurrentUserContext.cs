namespace TanPms.Application.Common.Abstractions;

public interface ICurrentUserContext
{
    string UserId { get; }
    bool IsAdminScope { get; }
    bool IsClientScope { get; }
    IReadOnlySet<Guid> AllowedPropertyIds { get; }
    IReadOnlySet<string> Permissions { get; }
    Guid? CustomerId { get; }
    bool HasOpenCashierShift { get; }
}
