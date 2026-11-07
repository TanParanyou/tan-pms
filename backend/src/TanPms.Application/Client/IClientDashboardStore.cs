using TanPms.Application.Common.Results;

namespace TanPms.Application.Client;

public interface IClientDashboardStore
{
    Result<ClientDashboardResponse> GetClientDashboard(Guid customerId);
}
