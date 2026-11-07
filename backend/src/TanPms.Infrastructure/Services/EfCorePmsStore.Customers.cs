using Microsoft.EntityFrameworkCore;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Customers;
using TanPms.Domain.Common;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public Result<CustomerListResponse> SearchAdminCustomers(Guid propertyId, string? search)
    {
        if (!_dbContext.Properties.AsNoTracking().Any(p => p.Id == propertyId))
        {
            return Result<CustomerListResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                $"Property '{propertyId}' was not found."));
        }

        var query = _dbContext.Customers.AsNoTracking();
        var term = search?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(term))
        {
            // SQL-translatable equivalent of CustomerSearchRules.Matches (name contains / identity ends with).
            query = query.Where(c =>
                c.FullName.ToUpper().Contains(term)
                || c.NationalIdOrPassport.ToUpper().EndsWith(term));
        }

        var items = query
            .OrderBy(c => c.FullName)
            .Take(CustomerSearchRules.MaxResults)
            .ToList()
            .Select(c => new CustomerRefDto(c.Id, c.FullName, c.GetMaskedIdentity()))
            .ToList();

        return Result<CustomerListResponse>.Success(new CustomerListResponse(items));
    }
}
