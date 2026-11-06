using Microsoft.EntityFrameworkCore;
using TanPms.Infrastructure.Persistence;
using Xunit;

namespace TanPms.UnitTests;

public sealed class DbContextModelCreationTests
{
    [Fact]
    public void TanPmsDbContext_Model_CanBeCreatedWithoutErrors()
    {
        var options = new DbContextOptionsBuilder<TanPmsDbContext>()
            .UseNpgsql("Host=localhost;Database=test_tan_pms;Username=postgres;Password=postgres")
            .Options;

        using var context = new TanPmsDbContext(options);
        var model = context.Model;
        Assert.NotNull(model);
    }
}
