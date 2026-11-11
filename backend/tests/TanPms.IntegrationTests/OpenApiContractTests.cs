using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using TanPms.Application;
using Xunit;

namespace TanPms.IntegrationTests;

// Guards drift between the mapped Minimal API surface / public Application records and contracts/openapi/tan-pms.v1.json.
// Each assertion prints the complete mismatch list; fix the contract (or the code), never loosen these checks.
public sealed partial class OpenApiContractTests : IClassFixture<InMemoryWebApiFactory>
{
    private static readonly string[] IgnoredPathPrefixes = ["/health", "/swagger", "/openapi"];
    private static readonly string[] HttpVerbs = ["get", "post", "put", "patch", "delete"];

    private readonly InMemoryWebApiFactory _factory;

    public OpenApiContractTests(InMemoryWebApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public void Every_Mapped_Endpoint_Should_Be_In_The_Contract_And_Vice_Versa()
    {
        using var contract = LoadContract();
        var documented = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var path in contract.RootElement.GetProperty("paths").EnumerateObject())
        {
            if (IsIgnored(path.Name))
            {
                continue;
            }

            foreach (var operation in path.Value.EnumerateObject().Where(o => HttpVerbs.Contains(o.Name)))
            {
                documented.Add($"{operation.Name.ToUpperInvariant()} {path.Name}");
            }
        }

        _ = _factory.CreateClient();
        var mapped = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var endpoint in _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>())
        {
            var path = NormalizeRoute(endpoint.RoutePattern.RawText ?? string.Empty);
            if (IsIgnored(path))
            {
                continue;
            }

            foreach (var method in endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? [])
            {
                if (!string.Equals(method, "OPTIONS", StringComparison.OrdinalIgnoreCase))
                {
                    mapped.Add($"{method.ToUpperInvariant()} {path}");
                }
            }
        }

        var missingFromContract = mapped.Except(documented).ToList();
        var missingFromCode = documented.Except(mapped).ToList();
        Assert.True(
            missingFromContract.Count == 0 && missingFromCode.Count == 0,
            $"Endpoint drift.\nMapped but NOT in contract ({missingFromContract.Count}):\n  {string.Join("\n  ", missingFromContract)}\n"
            + $"In contract but NOT mapped ({missingFromCode.Count}):\n  {string.Join("\n  ", missingFromCode)}");
    }

    [Fact]
    public void OperationIds_Should_Be_Unique()
    {
        using var contract = LoadContract();
        var duplicates = contract.RootElement.GetProperty("paths").EnumerateObject()
            .SelectMany(p => p.Value.EnumerateObject().Where(o => HttpVerbs.Contains(o.Name)))
            .Where(o => o.Value.TryGetProperty("operationId", out _))
            .GroupBy(o => o.Value.GetProperty("operationId").GetString())
            .Where(g => g.Count() > 1)
            .Select(g => $"{g.Key} x{g.Count()}")
            .ToList();

        Assert.True(duplicates.Count == 0, $"Duplicate operationIds ({duplicates.Count}):\n  {string.Join("\n  ", duplicates)}");
    }

    [Fact]
    public void Every_Ref_Should_Resolve()
    {
        using var contract = LoadContract();
        var refs = new SortedSet<string>(StringComparer.Ordinal);
        CollectRefs(contract.RootElement, refs);

        var unresolved = refs.Where(r => !TryResolvePointer(contract.RootElement, r)).ToList();
        Assert.True(unresolved.Count == 0, $"Unresolved $ref ({unresolved.Count}):\n  {string.Join("\n  ", unresolved)}");
    }

    [Fact]
    public void Schemas_Should_Match_Public_Application_Records_And_Required_Should_Be_Declared()
    {
        using var contract = LoadContract();
        var typesByName = typeof(ApplicationMarker).Assembly.GetExportedTypes()
            .Where(t => (t.IsClass || (t.IsValueType && !t.IsEnum)) && !t.IsGenericTypeDefinition && !t.IsAbstract)
            .GroupBy(t => t.Name)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var problems = new List<string>();
        foreach (var schema in contract.RootElement.GetProperty("components").GetProperty("schemas").EnumerateObject())
        {
            if (!schema.Value.TryGetProperty("properties", out var propertiesElement))
            {
                continue;
            }

            var contractProps = propertiesElement.EnumerateObject().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);
            if (schema.Value.TryGetProperty("required", out var required))
            {
                var undeclared = required.EnumerateArray().Select(r => r.GetString() ?? string.Empty).Where(r => !contractProps.Contains(r)).ToList();
                if (undeclared.Count > 0)
                {
                    problems.Add($"{schema.Name}: required but not in properties [{string.Join(", ", undeclared)}]");
                }
            }

            if (!typesByName.TryGetValue(schema.Name, out var candidates))
            {
                continue;
            }

            var diffs = candidates.Select(type => DiffProperties(type, contractProps)).ToList();
            if (diffs.All(d => d.Length > 0))
            {
                problems.Add($"{schema.Name}: {diffs[0]}");
            }
        }

        Assert.True(problems.Count == 0, $"Schema drift ({problems.Count}):\n  {string.Join("\n  ", problems)}");
    }

    private static string DiffProperties(Type type, HashSet<string> contractProps)
    {
        var codeProps = type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.GetIndexParameters().Length == 0 && p.Name != "EqualityContract")
            .Select(p => JsonNamingPolicy.CamelCase.ConvertName(p.Name))
            .ToHashSet(StringComparer.Ordinal);
        var missingInContract = codeProps.Except(contractProps).OrderBy(x => x, StringComparer.Ordinal).ToList();
        var missingInCode = contractProps.Except(codeProps).OrderBy(x => x, StringComparer.Ordinal).ToList();
        if (missingInContract.Count == 0 && missingInCode.Count == 0)
        {
            return string.Empty;
        }

        return $"code-only [{string.Join(", ", missingInContract)}] contract-only [{string.Join(", ", missingInCode)}] ({type.FullName})";
    }

    private static void CollectRefs(JsonElement element, ISet<string> refs)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    if (property.Name == "$ref" && property.Value.ValueKind == JsonValueKind.String)
                    {
                        refs.Add(property.Value.GetString() ?? string.Empty);
                    }
                    else
                    {
                        CollectRefs(property.Value, refs);
                    }
                }

                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    CollectRefs(item, refs);
                }

                break;
        }
    }

    private static bool TryResolvePointer(JsonElement root, string reference)
    {
        if (!reference.StartsWith("#/", StringComparison.Ordinal))
        {
            return false;
        }

        var current = root;
        foreach (var rawSegment in reference[2..].Split('/'))
        {
            var segment = rawSegment.Replace("~1", "/", StringComparison.Ordinal).Replace("~0", "~", StringComparison.Ordinal);
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(segment, out current))
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsIgnored(string path) =>
        IgnoredPathPrefixes.Any(prefix => path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

    // "/api/v1/x/{id:guid}" and "/files/{**fileKey}" -> "/api/v1/x/{id}" and "/files/{fileKey}".
    private static string NormalizeRoute(string raw)
    {
        var path = raw.StartsWith('/') ? raw : "/" + raw;
        return RouteParameterRegex().Replace(path, m => "{" + m.Groups["name"].Value + "}");
    }

    private static JsonDocument LoadContract()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "contracts", "openapi", "tan-pms.v1.json");
            if (File.Exists(candidate))
            {
                return JsonDocument.Parse(File.ReadAllText(candidate));
            }

            directory = directory.Parent;
        }

        throw new FileNotFoundException("contracts/openapi/tan-pms.v1.json was not found above " + AppContext.BaseDirectory);
    }

    [GeneratedRegex(@"\{\**(?<name>[A-Za-z0-9_]+)(:[^}]*)?\??\}")]
    private static partial Regex RouteParameterRegex();
}
