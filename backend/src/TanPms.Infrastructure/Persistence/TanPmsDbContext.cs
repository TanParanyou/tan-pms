using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;
using TanPms.Domain.Leases;
using TanPms.Domain.Meters;
using TanPms.Domain.Notifications;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Rates;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Persistence;

public sealed class TanPmsDbContext : DbContext
{
    public TanPmsDbContext(DbContextOptions<TanPmsDbContext> options)
        : base(options)
    {
    }

    public DbSet<DocumentSequence> DocumentSequences => Set<DocumentSequence>();
    public DbSet<Property> Properties => Set<Property>();
    public DbSet<Building> Buildings => Set<Building>();
    public DbSet<Floor> Floors => Set<Floor>();
    public DbSet<UnitType> UnitTypes => Set<UnitType>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<UnitAsset> UnitAssets => Set<UnitAsset>();
    public DbSet<RatePlan> RatePlans => Set<RatePlan>();
    public DbSet<PropertyUtilityTariff> PropertyUtilityTariffs => Set<PropertyUtilityTariff>();
    public DbSet<TaxProfile> TaxProfiles => Set<TaxProfile>();
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
    public DbSet<PaymentSlip> PaymentSlips => Set<PaymentSlip>();
    public DbSet<CashierShift> CashierShifts => Set<CashierShift>();
    public DbSet<DepositLedger> DepositLedgers => Set<DepositLedger>();
    public DbSet<DepositTransaction> DepositTransactions => Set<DepositTransaction>();
    public DbSet<HousekeepingTask> HousekeepingTasks => Set<HousekeepingTask>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<Parcel> Parcels => Set<Parcel>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<LeaseIntentRequest> LeaseIntentRequests => Set<LeaseIntentRequest>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        configurationBuilder
            .Properties<LocalizedText>()
            .HaveConversion<LocalizedTextValueConverter>()
            .HaveColumnType("jsonb");

        configurationBuilder
            .Properties<LocalizedText?>()
            .HaveConversion<OptionalLocalizedTextValueConverter>()
            .HaveColumnType("jsonb");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DocumentSequence>(b =>
        {
            b.ToTable("document_sequences");
            b.HasKey(x => new { x.PropertyId, x.DocumentType, x.PeriodYyMm });

            b.Property(x => x.PropertyId)
                .HasColumnName("property_id")
                .IsRequired();

            b.Property(x => x.DocumentType)
                .HasColumnName("document_type")
                .HasMaxLength(16)
                .IsRequired();

            b.Property(x => x.PeriodYyMm)
                .HasColumnName("period_yymm")
                .HasMaxLength(8)
                .IsRequired();

            b.Property(x => x.LastSequence)
                .HasColumnName("last_sequence")
                .IsRequired();

            b.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();
        });

        modelBuilder.Entity<Property>(b =>
        {
            b.HasMany(x => x.Buildings)
                .WithOne()
                .HasForeignKey(x => x.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(x => x.UnitTypes)
                .WithOne()
                .HasForeignKey(x => x.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Building>(b =>
        {
            b.HasMany(x => x.Floors)
                .WithOne()
                .HasForeignKey(x => x.BuildingId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Floor>(b =>
        {
            b.HasMany(x => x.Units)
                .WithOne()
                .HasForeignKey(x => x.FloorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Unit>(b =>
        {
            b.HasMany(x => x.Assets)
                .WithOne()
                .HasForeignKey(x => x.UnitId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DepositLedger>(b =>
        {
            b.HasMany(x => x.Transactions)
                .WithOne()
                .HasForeignKey(x => x.DepositLedgerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Folio>(b =>
        {
            b.HasMany(x => x.Charges)
                .WithOne()
                .HasForeignKey("FolioId")
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FolioCharge>(b =>
        {
            b.ToTable("FolioCharge");
            b.HasKey(x => x.Id);
        });

        modelBuilder.Entity<Invoice>(b =>
        {
            b.HasMany(x => x.Lines)
                .WithOne()
                .HasForeignKey("InvoiceId")
                .OnDelete(DeleteBehavior.Cascade);

            b.Property(x => x.BillingPeriodYearMonth).HasMaxLength(7);

            // One live (non-deleted, non-voided) invoice per lease per billing period keeps batch runs idempotent.
            b.HasIndex(x => new { x.LeaseId, x.BillingPeriodYearMonth })
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false AND \"Status\" <> 6 AND \"LeaseId\" IS NOT NULL AND \"BillingPeriodYearMonth\" IS NOT NULL");
        });

        modelBuilder.Entity<CashierShift>(b =>
        {
            // At most one Open shift per cashier per property.
            b.HasIndex(x => new { x.PropertyId, x.CashierUserId })
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false AND \"Status\" = 1");
        });

        modelBuilder.Entity<Receipt>(b =>
        {
            // One receipt per approved payment slip (race-safe approval).
            b.HasIndex(x => x.PaymentSlipId)
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false AND \"PaymentSlipId\" IS NOT NULL");
            b.HasIndex(x => x.InvoiceId);
        });

        modelBuilder.Entity<PaymentSlip>(b =>
        {
            b.Property(x => x.SlipFileKey).HasMaxLength(512);
            b.Property(x => x.TransferReference).HasMaxLength(128);
            b.HasIndex(x => new { x.PropertyId, x.Status });
            b.HasIndex(x => x.InvoiceId);
        });

        modelBuilder.Entity<WorkOrder>(b =>
        {
            b.Property(x => x.IssueSummary).HasMaxLength(200);
            b.Property(x => x.Description).HasMaxLength(2000);
            b.Property(x => x.ResolutionNotes).HasMaxLength(2000);
            b.Property(x => x.CancelReason).HasMaxLength(2000);
            b.HasIndex(x => new { x.PropertyId, x.Status });
            b.HasIndex(x => x.ReportedByCustomerId);
        });

        modelBuilder.Entity<Lease>(b =>
        {
            b.Property(x => x.CancelReason).HasMaxLength(2000);
        });

        modelBuilder.Entity<CashierShift>(b =>
        {
            b.Property(x => x.CancelReason).HasMaxLength(2000);
        });

        modelBuilder.Entity<Parcel>(b =>
        {
            b.Property(x => x.RecipientName).HasMaxLength(200);
            b.Property(x => x.VoidReason).HasMaxLength(2000);
            b.HasIndex(x => new { x.PropertyId, x.Status });
            b.HasIndex(x => x.CustomerId);
        });

        modelBuilder.Entity<LeaseIntentRequest>(b =>
        {
            b.Property(x => x.Note).HasMaxLength(1000);
            b.Property(x => x.RejectReason).HasMaxLength(1000);
            b.Property(x => x.ReviewedByUserId).HasMaxLength(128);
            b.HasIndex(x => new { x.PropertyId, x.Status });
            b.HasIndex(x => x.CustomerId);
            // At most one Pending intent per lease.
            b.HasIndex(x => x.LeaseId)
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false AND \"Status\" = 1");
        });

        modelBuilder.Entity<FolioCharge>(b =>
        {
            b.Property(x => x.ChargeCategoryCode).HasMaxLength(64);
            b.Property(x => x.VoidReason).HasMaxLength(1000);
        });

        modelBuilder.Entity<Occupant>(b =>
        {
            b.Property(x => x.PhoneNumber).HasMaxLength(32);
            b.Property(x => x.IdentityDocumentFileKey).HasMaxLength(32);
        });

        modelBuilder.Entity<Stay>(b =>
        {
            b.Property(x => x.Note).HasMaxLength(1000);
            b.Property(x => x.CancelReason).HasMaxLength(2000);
        });

        modelBuilder.Entity<Reservation>(b =>
        {
            b.Property(x => x.Note).HasMaxLength(1000);
        });

        modelBuilder.Entity<StoredFile>(b =>
        {
            b.Property(x => x.FileKey).HasMaxLength(32);
            b.Property(x => x.ContentType).HasMaxLength(64);
            b.Property(x => x.UploadedByUserId).HasMaxLength(128);
            b.HasIndex(x => x.FileKey).IsUnique();
        });

        modelBuilder.Entity<HousekeepingTask>(b =>
        {
            b.Property(x => x.Note).HasMaxLength(1000);
        });

        modelBuilder.Entity<MeterReading>(b =>
        {
            b.Property(x => x.BillingPeriodYearMonth).HasMaxLength(7);

            b.HasIndex(x => new { x.UnitId, x.UtilityType, x.BillingPeriodYearMonth })
                .IsUnique()
                .HasFilter("\"IsDeleted\" = false");
        });

        modelBuilder.Entity<InvoiceLine>(b =>
        {
            b.ToTable("InvoiceLine");
            b.HasKey(x => x.Id);
            b.Property(x => x.ChargeCategoryCode).HasMaxLength(64);
        });

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
                else if (property.ClrType == typeof(LocalizedText))
                {
                    property.SetColumnType("jsonb");
                    property.SetValueConverter(
                        property.IsNullable
                            ? typeof(OptionalLocalizedTextValueConverter)
                            : typeof(LocalizedTextValueConverter));
                }
            }
        }
    }
}
