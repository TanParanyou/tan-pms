using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TanPms.Domain.Common;
using TanPms.Domain.Entities;

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
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Occupant> Occupants => Set<Occupant>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<Stay> Stays => Set<Stay>();
    public DbSet<Folio> Folios => Set<Folio>();
    public DbSet<Lease> Leases => Set<Lease>();
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
}
