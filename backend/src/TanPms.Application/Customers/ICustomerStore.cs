using TanPms.Application.Common.Results;

namespace TanPms.Application.Customers;

public interface ICustomerStore
{
    Result<CustomerListResponse> SearchAdminCustomers(Guid propertyId, string? search);
}
