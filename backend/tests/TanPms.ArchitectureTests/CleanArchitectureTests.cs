using ArchUnitNET.Domain;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnit;
using TanPms.Application.Abstractions;
using TanPms.Domain.Common;
using TanPms.Domain.Entities;
using TanPms.Domain.Enums;
using TanPms.Infrastructure.Persistence;
using Xunit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

namespace TanPms.ArchitectureTests;

public sealed class CleanArchitectureTests
{
    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(
            typeof(AuditableEntity).Assembly,
            typeof(ICurrentUserContext).Assembly,
            typeof(TanPmsDbContext).Assembly,
            typeof(Program).Assembly)
        .Build();

    [Fact]
    public void Domain_Should_Not_Depend_On_Outer_Layers_Or_EfCore()
    {
        var rule = Types()
            .That()
            .ResideInAssembly(typeof(AuditableEntity).Assembly)
            .Should()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(ICurrentUserContext).Assembly))
            .AndShould()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(TanPmsDbContext).Assembly))
            .AndShould()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(Program).Assembly));

        rule.Check(Architecture);

        var referencedAssemblies = typeof(AuditableEntity).Assembly
            .GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty)
            .ToList();

        Assert.DoesNotContain(referencedAssemblies, name => name.Contains("EntityFrameworkCore", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(referencedAssemblies, name => name.Contains("Dapper", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Application_Should_Not_Depend_On_Infrastructure_Or_WebApi()
    {
        var rule = Types()
            .That()
            .ResideInAssembly(typeof(ICurrentUserContext).Assembly)
            .Should()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(TanPmsDbContext).Assembly))
            .AndShould()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(Program).Assembly));

        rule.Check(Architecture);
    }

    [Fact]
    public void Domain_Types_Should_Never_Use_Float_Or_Double_Properties()
    {
        var domainTypes = typeof(AuditableEntity).Assembly.GetTypes();
        foreach (var type in domainTypes)
        {
            foreach (var prop in type.GetProperties())
            {
                Assert.NotEqual(typeof(float), prop.PropertyType);
                Assert.NotEqual(typeof(float?), prop.PropertyType);
                Assert.NotEqual(typeof(double), prop.PropertyType);
                Assert.NotEqual(typeof(double?), prop.PropertyType);
            }
        }
    }

    [Fact]
    public void Domain_Should_Contain_All_20_Canonical_Ubiquitous_Language_Terms()
    {
        var domainTypeNames = typeof(AuditableEntity).Assembly
            .GetTypes()
            .Select(t => t.Name)
            .ToHashSet(StringComparer.Ordinal);

        string[] canonicalTerms =
        [
            nameof(Property),
            nameof(Building),
            nameof(Floor),
            nameof(UnitType),
            nameof(Unit),
            nameof(StayMode),
            nameof(Customer),
            nameof(Occupant),
            nameof(Reservation),
            nameof(Stay),
            nameof(Folio),
            nameof(Lease),
            nameof(MeterReading),
            nameof(Invoice),
            nameof(Receipt),
            nameof(CashierShift),
            nameof(DepositLedger),
            nameof(HousekeepingTask),
            nameof(WorkOrder),
            nameof(Parcel)
        ];

        foreach (var term in canonicalTerms)
        {
            Assert.Contains(term, domainTypeNames);
        }
    }
}
