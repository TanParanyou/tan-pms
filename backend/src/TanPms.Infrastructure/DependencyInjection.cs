using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TanPms.Application.Billing;
using TanPms.Application.Client;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Customers;
using TanPms.Application.Identity;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Notifications;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Services;

namespace TanPms.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddTanPmsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=tan_pms;Username=postgres;Password=postgres";

        services.AddScoped<AuditableEntityInterceptor>();

        services.AddDbContext<TanPmsDbContext>((sp, options) =>
        {
            options
                .UseNpgsql(
                    connectionString,
                    npgsql => npgsql.MigrationsAssembly(typeof(TanPmsDbContext).Assembly.FullName))
                .AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>());
        });

        var provider = configuration["Persistence:Provider"] ?? "Postgres";
        if (string.Equals(provider, "InMemory", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<InMemoryOperationalService>();
            services.AddSingleton<IPmsOperationalStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IIdentityStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<INotificationStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IPropertyCatalogStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IRateCatalogStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IReservationStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IStayStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<ILeaseStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<ICustomerStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IMeterReadingStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IBillingStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IRoomRackStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IClientDashboardStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IDocumentNumberService>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IAuditLogger>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<INotificationSender>(sp => sp.GetRequiredService<InMemoryOperationalService>());
        }
        else
        {
            services.AddScoped<IDocumentNumberService, PostgresDocumentNumberService>();
            services.AddScoped<IAuditLogger, EfCoreAuditLogger>();
            services.AddScoped<INotificationSender, EfCoreNotificationSender>();
            services.AddScoped<EfCorePmsStore>();
            services.AddScoped<IPmsOperationalStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IIdentityStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<INotificationStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IPropertyCatalogStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IRateCatalogStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IReservationStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IStayStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<ILeaseStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<ICustomerStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IMeterReadingStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IBillingStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IRoomRackStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IClientDashboardStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
        }

        return services;
    }
}
