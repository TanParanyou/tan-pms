using System.Text.Json;
using TanPms.Domain.Common;
using Xunit;

namespace TanPms.UnitTests;

public sealed class LocalizedTextTests
{
    [Fact]
    public void Create_Should_Trim_Thai_And_English_And_Resolve_By_Locale()
    {
        var text = LocalizedText.Create("  มาตรฐาน 24 ตร.ม.  ", "  Standard 24 sqm  ");

        Assert.Equal("มาตรฐาน 24 ตร.ม.", text.Thai);
        Assert.Equal("Standard 24 sqm", text.English);
        Assert.Equal("มาตรฐาน 24 ตร.ม.", text.Resolve("th"));
        Assert.Equal("มาตรฐาน 24 ตร.ม.", text.Resolve(null));
        Assert.Equal("Standard 24 sqm", text.Resolve("en-US"));
    }

    [Fact]
    public void Create_Should_Throw_DomainRuleException_When_Thai_Is_Blank()
    {
        var ex = Assert.Throws<DomainRuleException>(() =>
            LocalizedText.Create("   ", "Standard 24 sqm"));

        Assert.Equal(DomainErrorCodes.LocalizedTextThaiRequired, ex.ErrorCode);
        Assert.Equal(400, ex.HttpStatus);
    }

    [Fact]
    public void JsonSerialization_Should_Use_Th_And_En_Keys()
    {
        var text = LocalizedText.Create("อาคาร A", "Building A");
        var json = JsonSerializer.Serialize(text);

        Assert.Contains("\"th\":", json, StringComparison.Ordinal);
        Assert.Contains("\"en\":\"Building A\"", json, StringComparison.Ordinal);

        var roundTrip = JsonSerializer.Deserialize<LocalizedText>(json);
        Assert.NotNull(roundTrip);
        Assert.Equal("อาคาร A", roundTrip.Thai);
        Assert.Equal("Building A", roundTrip.English);
    }
}
