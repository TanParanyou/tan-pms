using TanPms.Application.Common.Abstractions;
using TanPms.Domain.Identity;
using TanPms.Infrastructure.Services;

namespace TanPms.WebApi.Security;

public sealed class HttpCurrentUserContext : ICurrentUserContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpCurrentUserContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string UserId
    {
        get
        {
            var header = GetHeader("X-TanPms-User-Id");
            if (!string.IsNullOrWhiteSpace(header))
            {
                return header;
            }

            return IsClientScope ? "client-user-01" : "admin-user-01";
        }
    }

    public bool IsAdminScope
    {
        get
        {
            var explicitScope = GetHeader("X-TanPms-Scope");
            if (!string.IsNullOrWhiteSpace(explicitScope))
            {
                return string.Equals(explicitScope, "admin", StringComparison.OrdinalIgnoreCase);
            }

            var path = _httpContextAccessor.HttpContext?.Request.Path.Value ?? string.Empty;
            return !path.StartsWith("/api/v1/client", StringComparison.OrdinalIgnoreCase);
        }
    }

    public bool IsClientScope
    {
        get
        {
            var explicitScope = GetHeader("X-TanPms-Scope");
            if (!string.IsNullOrWhiteSpace(explicitScope))
            {
                return string.Equals(explicitScope, "client", StringComparison.OrdinalIgnoreCase);
            }

            var path = _httpContextAccessor.HttpContext?.Request.Path.Value ?? string.Empty;
            return path.StartsWith("/api/v1/client", StringComparison.OrdinalIgnoreCase);
        }
    }

    public IReadOnlySet<Guid> AllowedPropertyIds
    {
        get
        {
            var header = GetHeader("X-TanPms-Allowed-Properties");
            if (header is null)
            {
                return new HashSet<Guid> { PmsSeedConstants.BkkPropertyId };
            }

            var parsed = new HashSet<Guid>();
            foreach (var part in header.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (Guid.TryParse(part, out var id))
                {
                    parsed.Add(id);
                }
            }

            return parsed;
        }
    }

    public IReadOnlySet<string> Permissions
    {
        get
        {
            var header = GetHeader("X-TanPms-Permissions");
            if (header is null)
            {
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "admin.rack.view",
                    PermissionKeys.AdminStayCheckIn,
                    PermissionKeys.AdminUsersRead,
                    PermissionKeys.AdminUsersManage,
                    PermissionKeys.AdminPropertiesRead,
                    PermissionKeys.AdminPropertiesManage,
                    PermissionKeys.AdminRatesManage,
                    PermissionKeys.AdminReservationsRead,
                    PermissionKeys.AdminReservationsManage,
                    PermissionKeys.AdminStayCheckOut,
                    PermissionKeys.AdminRegulatoryExport,
                    PermissionKeys.AdminLeasesManage,
                    PermissionKeys.AdminLeasesSettleMoveOut,
                    PermissionKeys.AdminMetersRecord,
                    PermissionKeys.AdminBillingIssueBatch
                };
            }

            return new HashSet<string>(
                header.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                StringComparer.OrdinalIgnoreCase);
        }
    }

    public Guid? CustomerId
    {
        get
        {
            var header = GetHeader("X-TanPms-Customer-Id");
            if (!string.IsNullOrWhiteSpace(header) && Guid.TryParse(header, out var parsed))
            {
                return parsed;
            }

            return IsClientScope ? PmsSeedConstants.PrimaryCustomerId : null;
        }
    }

    public bool HasOpenCashierShift
    {
        get
        {
            var header = GetHeader("X-TanPms-Open-Shift");
            if (!string.IsNullOrWhiteSpace(header) && bool.TryParse(header, out var parsed))
            {
                return parsed;
            }

            return true;
        }
    }

    private string? GetHeader(string name)
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null || !context.Request.Headers.TryGetValue(name, out var values))
        {
            return null;
        }

        return values.ToString();
    }
}
