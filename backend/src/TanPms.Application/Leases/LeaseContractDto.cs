using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Leases;

public sealed record LeaseContractDto(
    PropertyLetterheadDto Property,
    LeaseItemDto Lease);
