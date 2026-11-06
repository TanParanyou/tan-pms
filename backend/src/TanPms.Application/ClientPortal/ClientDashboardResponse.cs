using TanPms.Application.Common.Contracts;

namespace TanPms.Application.ClientPortal;

public sealed record ClientDashboardResponse(
    CustomerRefDto Customer,
    ClientHoldReservationDto? ActiveHoldReservation,
    ClientActiveLeaseDto? ActiveLease,
    IReadOnlyList<ClientUnpaidInvoiceDto> UnpaidInvoices,
    IReadOnlyList<ClientPendingParcelDto> PendingParcels);
