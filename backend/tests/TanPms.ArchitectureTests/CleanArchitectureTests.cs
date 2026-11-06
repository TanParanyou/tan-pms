using System.Text.RegularExpressions;
using ArchUnitNET.Domain;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnit;
using TanPms.Application;
using TanPms.Domain;
using TanPms.Domain.Billing;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.Customers;
using TanPms.Domain.Leases;
using TanPms.Domain.Meters;
using TanPms.Domain.Operations;
using TanPms.Domain.Properties;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;
using TanPms.Infrastructure;
using TanPms.WebApi;
using Xunit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

namespace TanPms.ArchitectureTests;

public sealed class CleanArchitectureTests
{
    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(
            typeof(DomainMarker).Assembly,
            typeof(ApplicationMarker).Assembly,
            typeof(InfrastructureMarker).Assembly,
            typeof(ApiMarker).Assembly)
        .Build();

    [Fact]
    public void Domain_Should_Not_Depend_On_Outer_Layers_Or_EfCore()
    {
        var rule = Types()
            .That()
            .ResideInAssembly(typeof(DomainMarker).Assembly)
            .Should()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(ApplicationMarker).Assembly))
            .AndShould()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(InfrastructureMarker).Assembly))
            .AndShould()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(ApiMarker).Assembly));

        rule.Check(Architecture);

        var referencedAssemblies = typeof(DomainMarker).Assembly
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
            .ResideInAssembly(typeof(ApplicationMarker).Assembly)
            .Should()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(InfrastructureMarker).Assembly))
            .AndShould()
            .NotDependOnAny(
                Types().That().ResideInAssembly(typeof(ApiMarker).Assembly));

        rule.Check(Architecture);
    }

    [Fact]
    public void Domain_Types_Should_Never_Use_Float_Or_Double_Properties()
    {
        var domainTypes = typeof(DomainMarker).Assembly.GetTypes();
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
        var domainTypeNames = typeof(DomainMarker).Assembly
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

    [Fact]
    public void Domain_And_Application_Source_Files_Should_Enforce_One_Public_Type_Per_File()
    {
        var repoBackendSrc = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..", "..", "src"));

        var targetDirs = new[]
        {
            Path.Combine(repoBackendSrc, "TanPms.Domain"),
            Path.Combine(repoBackendSrc, "TanPms.Application")
        };

        var publicTypeRegex = new Regex(
            @"^\s*public\s+(?:(?:sealed|abstract|static|partial)\s+)*(?:class|record|enum|interface|struct)\s+([A-Za-z0-9_]+)",
            RegexOptions.Multiline | RegexOptions.Compiled);

        foreach (var dir in targetDirs)
        {
            Assert.True(Directory.Exists(dir), $"Expected source directory {dir} to exist.");
            var csFiles = Directory.GetFiles(dir, "*.cs", SearchOption.AllDirectories)
                .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                         && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
                .ToList();

            Assert.NotEmpty(csFiles);

            foreach (var file in csFiles)
            {
                var content = File.ReadAllText(file);
                var matches = publicTypeRegex.Matches(content);
                Assert.True(
                    matches.Count == 1,
                    $"File '{Path.GetRelativePath(repoBackendSrc, file)}' must declare exactly 1 public type, but found {matches.Count}.");
            }
        }
    }
}
