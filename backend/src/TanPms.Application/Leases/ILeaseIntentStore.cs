using TanPms.Application.Common.Models;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;

namespace TanPms.Application.Leases;

public interface ILeaseIntentStore
{
    Result<LeaseIntentDto> CreateClientLeaseIntent(Guid customerId, Guid leaseId, CreateLeaseIntentRequest request, DateTimeOffset? nowUtc = null);

    Result<LeaseIntentListResponse> GetClientLeaseIntents(Guid customerId);

    Result<LeaseIntentDto> UpdateClientLeaseIntent(Guid customerId, Guid intentId, UpdateLeaseIntentRequest request, DateTimeOffset? nowUtc = null);

    Result<LeaseIntentDto> WithdrawClientLeaseIntent(Guid customerId, Guid intentId);

    Result<LeaseIntentListResponse> GetAdminLeaseIntents(Guid propertyId, string? status, bool unmaskPii = false, PageRequest? paging = null);

    Result<LeaseIntentDto> ApproveAdminLeaseIntent(Guid propertyId, Guid intentId, string reviewerUserId, DateTimeOffset? nowUtc = null);

    Result<LeaseIntentDto> RejectAdminLeaseIntent(Guid propertyId, Guid intentId, string reviewerUserId, ReasonRequest request, DateTimeOffset? nowUtc = null);
}
