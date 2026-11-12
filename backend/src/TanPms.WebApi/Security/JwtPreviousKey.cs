namespace TanPms.WebApi.Security;

// A retired signing key still accepted for validation only (never for issuing).
public sealed record JwtPreviousKey(string KeyId, byte[] Key);
