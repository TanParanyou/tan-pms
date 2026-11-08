using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.Application.Reservations;

public sealed class SubmitClientReservationSlipHandler
{
    private readonly IReservationStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IStoredFileStore _files;

    public SubmitClientReservationSlipHandler(IReservationStore store, ICurrentUserContext currentUser, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _files = files;
    }

    public Result<ReservationItemDto> Handle(SubmitClientReservationSlipCommand command)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<ReservationItemDto>.Failure(authError);
        }

        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.PaymentSlip, null, customerId, command.Request.PaymentSlipFileKey) is { } fileError)
        {
            return Result<ReservationItemDto>.Failure(fileError);
        }

        return _store.SubmitClientReservationSlip(
            customerId,
            command.ReservationId,
            command.Request);
    }
}
