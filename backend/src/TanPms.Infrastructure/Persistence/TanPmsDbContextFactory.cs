using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TanPms.Infrastructure.Persistence;

public sealed class TanPmsDbContextFactory : IDesignTimeDbContextFactory<TanPmsDbContext>
{
    public TanPmsDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? "Development";

        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            if (!string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(environment, "Testing", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "ConnectionStrings__DefaultConnection must be configured when running outside Development or Testing environments.");
            }

            connectionString = "Host=localhost;Port=5432;Database=tan_pms;Username=postgres;Password=postgres";
        }

        var optionsBuilder = new DbContextOptionsBuilder<TanPmsDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new TanPmsDbContext(optionsBuilder.Options);
    }
}
