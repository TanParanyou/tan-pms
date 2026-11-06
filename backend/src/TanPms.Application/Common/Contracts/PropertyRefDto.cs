namespace TanPms.Application.Common.Contracts;

public sealed record PropertyRefDto(
    Guid Id,
    string Code,
    LocalizedTextDto Name);
