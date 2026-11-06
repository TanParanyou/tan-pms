using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Identity;
using TanPms.Domain.Leases;
using TanPms.Domain.Meters;
using TanPms.Domain.Notifications;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Persistence;

public sealed class TanPmsDbContext : DbContext
{
    public TanPmsDbContext(DbContextOptions<TanPmsDbContext> options)
        : base(options)
    {
    }

    public DbSet<Property> Properties => Set<Property>();
    public DbSet<Building> Buildings => Set<Building>();
    public DbSet<Floor> Floors => Set<Floor>();
    public DbSet<UnitType> UnitTypes => Set<UnitType>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<UnitAsset> UnitAssets => Set<UnitAsset>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Occupant> Occupants => Set<Occupant>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<NotificationMessage> NotificationMessages => Set<NotificationMessage>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<Stay> Stays => Set<Stay>();
    public DbSet<Folio> Folios => Set<Folio>();
    public DbSet<Lease> Leases => Set<Lease>();
    public DbSet<TenantVehicle> TenantVehicles => Set<TenantVehicle>();
    public DbSet<MeterReading> MeterReadings => Set<MeterReading>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Receipt> Receipts => Set<Receipt>();
    public DbSet<CashierShift> CashierShifts => Set<CashierShift>();
    public DbSet<DepositLedger> DepositLedgers => Set<DepositLedger>();
    public DbSet<DepositTransaction> DepositTransactions => Set<DepositTransaction>();
    public DbSet<HousekeepingTask> HousekeepingTasks => Set<HousekeepingTask>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<Parcel> Parcels => Set<Parcel>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        configurationBuilder
            .Properties<LocalizedText>()
            .HaveConversion<LocalizedTextJsonConverter>()
            .HaveColumnType("jsonb");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(AuditableEntity).IsAssignableFrom(entityType.ClrType))
            {
                var parameter = Expression.Parameter(entityType.ClrType, "e");
                var isDeletedProp = Expression.Property(parameter, nameof(AuditableEntity.IsDeleted));
                var notDeleted = Expression.Equal(isDeletedProp, Expression.Constant(false));
                var lambda = Expression.Lambda(notDeleted, parameter);
                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
            }

            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
                {
                    property.SetPrecision(18);
                    property.SetScale(2);
                }
            }
        }
    }

    private sealed class LocalizedTextJsonConverter : ValueConverter<LocalizedText, string>
    {
        public LocalizedTextJsonConverter()
            : base(
                v => JsonSerializer.Serialize(new { th = v.Thai, en = v.English }, (JsonSerializerOptions?)null),
                v => DeserializeLocalizedText(v))
        {
        }

        private static LocalizedText DeserializeLocalizedText(string json)
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var th = root.TryGetProperty("th", out var thProp) ? thProp.GetString() ?? string.Empty : string.Empty;
            var en = root.TryGetProperty("en", out var enProp) ? enProp.GetString() : null;
            return new LocalizedText(th, en);
        }
    }
}
