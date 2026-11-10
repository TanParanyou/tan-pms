namespace TanPms.Application.Stays;

public sealed record UpdateStayRequest(
    DateTimeOffset? ExpectedCheckOutAt,
    string? Note);
