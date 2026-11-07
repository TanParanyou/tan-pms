using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TanPms.Infrastructure.Persistence;

public sealed class TanPmsDbContextFactory : IDesignTimeDbContextFactory<TanPmsDbContext>
{
    public TanPmsDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=tan_pms;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<TanPmsDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new TanPmsDbContext(optionsBuilder.Options);
    }
}
