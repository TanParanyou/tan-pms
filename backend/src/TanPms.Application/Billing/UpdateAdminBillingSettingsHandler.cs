using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class UpdateAdminBillingSettingsHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpdateAdminBillingSettingsHandler(IBillingStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<BillingSettingsDto> Handle(UpdateAdminBillingSettingsCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminPropertiesManage) is { } authError)
        {
            return Result<BillingSettingsDto>.Failure(authError);
        }

        if (BillingSettingsRules.Validate(command.Request) is { } validationError)
        {
            return Result<BillingSettingsDto>.Failure(validationError);
        }

        var before = _store.GetBillingSettings(command.PropertyId).Value;
        var result = _store.UpdateBillingSettings(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminPropertiesManage,
                entityId: command.PropertyId,
                reason: $"Payment terms set to {result.Value.EffectivePaymentTermsDays} days",
                afterState: new { result.Value.PaymentTermsDays },
                beforeState: new { before?.PaymentTermsDays });
        }

        return result;
    }
}
