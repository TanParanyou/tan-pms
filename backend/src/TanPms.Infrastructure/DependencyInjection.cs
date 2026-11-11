using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TanPms.Application.Analytics;
using TanPms.Application.Billing;
using TanPms.Application.Cashier;
using TanPms.Application.Client;
using TanPms.Application.Common.Abstractions;
using TanPms.Application.Customers;
using TanPms.Application.Files;
using TanPms.Application.Housekeeping;
using TanPms.Application.Identity;
using TanPms.Application.Leases;
using TanPms.Application.Meters;
using TanPms.Application.Notifications;
using TanPms.Application.Parcels;
using TanPms.Application.Payments;
using TanPms.Application.Properties;
using TanPms.Application.Rack;
using TanPms.Application.Rates;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Application.WorkOrders;
using TanPms.Infrastructure.Pdf;
using TanPms.Infrastructure.Persistence;
using TanPms.Infrastructure.Security;
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

        // Private local folder (never a public bucket); default lives under the git-ignored build output.
        var storageRoot = configuration["Storage:RootPath"];
        services.AddSingleton<IFileStorage>(new LocalDiskFileStorage(
            string.IsNullOrWhiteSpace(storageRoot) ? Path.Combine(AppContext.BaseDirectory, "App_Data", "files") : storageRoot));

        services.AddSingleton<IPdfDocumentRenderer, QuestPdfDocumentRenderer>();
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();

        var provider = configuration["Persistence:Provider"] ?? "Postgres";
        if (string.Equals(provider, "InMemory", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<InMemoryOperationalService>();
            services.AddSingleton<IPmsOperationalStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IIdentityStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IAuthStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<INotificationStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IPropertyCatalogStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IRateCatalogStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IReservationStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IStayStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<ILeaseStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<ICustomerStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IMeterReadingStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IBillingStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<ICashierShiftStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IDepositLedgerStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IPaymentSlipStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IHousekeepingStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IWorkOrderStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IParcelStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IStoredFileStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IReceiptStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<ILeaseIntentStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
            services.AddSingleton<IAnalyticsStore>(sp => sp.GetRequiredService<InMemoryOperationalService>());
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
            services.AddScoped<IAuthStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<INotificationStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IPropertyCatalogStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IRateCatalogStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IReservationStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IStayStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<ILeaseStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<ICustomerStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IMeterReadingStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IBillingStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<ICashierShiftStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IDepositLedgerStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IPaymentSlipStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IHousekeepingStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IWorkOrderStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IParcelStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IStoredFileStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IReceiptStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<ILeaseIntentStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IAnalyticsStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IRoomRackStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
            services.AddScoped<IClientDashboardStore>(sp => sp.GetRequiredService<EfCorePmsStore>());
        }

        return services;
    }
}
