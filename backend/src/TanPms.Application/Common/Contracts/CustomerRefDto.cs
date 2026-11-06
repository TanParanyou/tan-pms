namespace TanPms.Application.Common.Contracts;

public sealed record CustomerRefDto(
    Guid Id,
    string FullName,
    string MaskedNationalId);
