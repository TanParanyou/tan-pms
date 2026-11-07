using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Common.Security;

public static class ScopeAuthorizationGuard
{
    public static Error? CheckAdminScope(ICurrentUserContext user)
    {
        if (string.IsNullOrWhiteSpace(user.UserId))
        {
            return new Error(
                DomainErrorCodes.Unauthenticated,
                "Caller is not authenticated.");
        }

        if (!user.IsAdminScope)
        {
            return new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires AdminScope authorization.");
        }

        return null;
    }

    public static Error? CheckAdminPermission(ICurrentUserContext user, string requiredPermission)
    {
        var scopeError = CheckAdminScope(user);
        if (scopeError is not null)
        {
            return scopeError;
        }

        if (!user.Permissions.Contains(requiredPermission))
        {
            return new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{requiredPermission}'.");
        }

        return null;
    }

    public static Error? CheckAdminAnyPermission(
        ICurrentUserContext user,
        params ReadOnlySpan<string> acceptedPermissions)
    {
        var scopeError = CheckAdminScope(user);
        if (scopeError is not null)
        {
            return scopeError;
        }

        foreach (var permission in acceptedPermissions)
        {
            if (user.Permissions.Contains(permission))
            {
                return null;
            }
        }

        var primaryPermission = acceptedPermissions.Length > 0 ? acceptedPermissions[0] : string.Empty;
        return new Error(
            DomainErrorCodes.PermissionDenied,
            $"Caller lacks required permission '{primaryPermission}'.");
    }

    public static Error? CheckAdminPropertyAccess(ICurrentUserContext user, Guid propertyId)
    {
        var scopeError = CheckAdminScope(user);
        if (scopeError is not null)
        {
            return scopeError;
        }

        if (!user.AllowedPropertyIds.Contains(propertyId))
        {
            return new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{propertyId}'.");
        }

        return null;
    }

    public static Error? CheckAdminPropertyScope(
        ICurrentUserContext user,
        Guid propertyId,
        string requiredPermission)
    {
        var permError = CheckAdminPermission(user, requiredPermission);
        if (permError is not null)
        {
            return permError;
        }

        if (!user.AllowedPropertyIds.Contains(propertyId))
        {
            return new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{propertyId}'.");
        }

        return null;
    }

    public static Error? CheckAdminPropertyScopeAnyPermission(
        ICurrentUserContext user,
        Guid propertyId,
        params ReadOnlySpan<string> acceptedPermissions)
    {
        var permError = CheckAdminAnyPermission(user, acceptedPermissions);
        if (permError is not null)
        {
            return permError;
        }

        if (!user.AllowedPropertyIds.Contains(propertyId))
        {
            return new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{propertyId}'.");
        }

        return null;
    }

    public static Error? CheckClientScope(ICurrentUserContext user, out Guid customerId)
    {
        customerId = Guid.Empty;

        if (string.IsNullOrWhiteSpace(user.UserId))
        {
            return new Error(
                DomainErrorCodes.Unauthenticated,
                "Caller is not authenticated.");
        }

        if (!user.IsClientScope || user.CustomerId is null || user.CustomerId == Guid.Empty)
        {
            return new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope with a bound CustomerId.");
        }

        customerId = user.CustomerId.Value;
        return null;
    }

    public static Error? CheckClientScopeOnly(ICurrentUserContext user)
    {
        if (string.IsNullOrWhiteSpace(user.UserId))
        {
            return new Error(
                DomainErrorCodes.Unauthenticated,
                "Caller is not authenticated.");
        }

        if (!user.IsClientScope)
        {
            return new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope.");
        }

        return null;
    }
}
