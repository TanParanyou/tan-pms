using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Application.Files;
using TanPms.Domain.Common;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;

namespace TanPms.Application.Stays;

public sealed class CheckInStayHandler
{
    private readonly IStayStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IStoredFileStore _files;

    public CheckInStayHandler(IStayStore store, ICurrentUserContext currentUser, IStoredFileStore files)
    {
        _store = store;
        _currentUser = currentUser;
        _files = files;
    }

    public Result<StaySummaryDto> Handle(CheckInStayCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyAccess(_currentUser, command.PropertyId) is { } authError)
        {
            return Result<StaySummaryDto>.Failure(authError);
        }

        if (!_currentUser.HasOpenCashierShiftIn(command.PropertyId))
        {
            return Result<StaySummaryDto>.Failure(new Error(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift in the property before performing check-in."));
        }

        // Monthly is rejected by the store on purpose: monthly tenancies are created through POST .../leases.
        var documentKeys = (command.Occupants ?? []).Select(o => o.IdentityDocumentFileKey).ToArray();
        if (StoredFileRules.ValidateAttachments(_files, StoredFilePurpose.IdentityDocument, command.PropertyId, null, documentKeys) is { } fileError)
        {
            return Result<StaySummaryDto>.Failure(fileError);
        }

        var hasOverridePerm = _currentUser.Permissions.Contains(PermissionKeys.AdminStayOverrideDirtyCheckIn);
        return _store.CheckInStay(command, hasOverridePerm, cashierUserId: _currentUser.UserId);
    }
}
