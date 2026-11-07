using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Customers;
using TanPms.Domain.Common;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    public Result<CustomerListResponse> SearchAdminCustomers(Guid propertyId, string? search)
    {
        lock (_syncRoot)
        {
            if (!_properties.ContainsKey(propertyId))
            {
                return Result<CustomerListResponse>.Failure(new Error(
                    DomainErrorCodes.ValidationFailed,
                    $"Property '{propertyId}' was not found."));
            }

            var items = _customers.Values
                .Where(c => CustomerSearchRules.Matches(c.FullName, c.NationalIdOrPassport, search))
                .OrderBy(c => c.FullName, StringComparer.OrdinalIgnoreCase)
                .Take(CustomerSearchRules.MaxResults)
                .Select(c => new CustomerRefDto(c.Id, c.FullName, c.GetMaskedIdentity()))
                .ToList();

            return Result<CustomerListResponse>.Success(new CustomerListResponse(items));
        }
    }
}
