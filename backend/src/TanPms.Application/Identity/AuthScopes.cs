namespace TanPms.Application.Identity;

public static class AuthScopes
{
    public const string Admin = "admin";
    public const string Client = "client";

    public static string? Parse(string? scope) =>
        string.Equals(scope, Admin, StringComparison.OrdinalIgnoreCase) ? Admin
        : string.Equals(scope, Client, StringComparison.OrdinalIgnoreCase) ? Client
        : null;
}
