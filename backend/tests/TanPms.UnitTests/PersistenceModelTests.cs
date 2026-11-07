using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Properties;
using TanPms.Domain.Stays;
using TanPms.Infrastructure.Persistence;
using Xunit;

namespace TanPms.UnitTests;

public sealed class PersistenceModelTests
{
    [Fact]
    public void TanPmsDbContext_Model_CanBeCreatedWithoutErrors()
    {
        var options = new DbContextOptionsBuilder<TanPmsDbContext>()
            .UseNpgsql("Host=localhost;Database=test_tan_pms;Username=postgres;Password=postgres")
            .Options;

        using var dbContext = new TanPmsDbContext(options);

        // Accessing IDesignTimeModel forces full EF Core Relational ModelValidator execution
        var designTimeModel = dbContext.GetService<IDesignTimeModel>().Model;
        Assert.NotNull(designTimeModel);
        Assert.NotNull(dbContext.Model);

        // Ensure LocalizedText is never mistakenly discovered as an unkeyed entity
        Assert.Null(designTimeModel.FindEntityType(typeof(LocalizedText)));

        // Every mapped entity type must have a valid primary key
        foreach (var entityType in designTimeModel.GetEntityTypes())
        {
            Assert.NotNull(entityType.FindPrimaryKey());

            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(LocalizedText))
                {
                    Assert.Equal("jsonb", property.GetColumnType());
                    var converter = property.GetValueConverter();
                    Assert.NotNull(converter);

                    if (property.IsNullable)
                    {
                        Assert.IsType<OptionalLocalizedTextValueConverter>(converter);
                    }
                    else
                    {
                        Assert.IsType<LocalizedTextValueConverter>(converter);
                    }
                }
            }
        }

        // Verify required & optional LocalizedText fields explicitly on master data and child entities
        var propertyEntity = designTimeModel.FindEntityType(typeof(Property));
        Assert.NotNull(propertyEntity);
        Assert.Equal("jsonb", propertyEntity.FindProperty(nameof(Property.Name))!.GetColumnType());
        Assert.Equal("jsonb", propertyEntity.FindProperty(nameof(Property.Address))!.GetColumnType());

        var unitTypeEntity = designTimeModel.FindEntityType(typeof(UnitType));
        Assert.NotNull(unitTypeEntity);
        Assert.Equal("jsonb", unitTypeEntity.FindProperty(nameof(UnitType.Name))!.GetColumnType());
        Assert.Equal("jsonb", unitTypeEntity.FindProperty(nameof(UnitType.Description))!.GetColumnType());

        var folioChargeEntity = designTimeModel.FindEntityType(typeof(FolioCharge));
        Assert.NotNull(folioChargeEntity);
        Assert.Equal("jsonb", folioChargeEntity.FindProperty(nameof(FolioCharge.Description))!.GetColumnType());

        var invoiceLineEntity = designTimeModel.FindEntityType(typeof(InvoiceLine));
        Assert.NotNull(invoiceLineEntity);
        Assert.Equal("jsonb", invoiceLineEntity.FindProperty(nameof(InvoiceLine.Description))!.GetColumnType());

        // Verify DocumentSequence table and composite primary key
        var docSeqEntity = designTimeModel.FindEntityType(typeof(DocumentSequence));
        Assert.NotNull(docSeqEntity);
        Assert.Equal("document_sequences", docSeqEntity.GetTableName());
        var pkProps = docSeqEntity.FindPrimaryKey()!.Properties.Select(p => p.Name).ToArray();
        Assert.Equal(
            [nameof(DocumentSequence.PropertyId), nameof(DocumentSequence.DocumentType), nameof(DocumentSequence.PeriodYyMm)],
            pkProps);
    }
}
