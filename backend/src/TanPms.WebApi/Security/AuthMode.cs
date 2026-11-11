namespace TanPms.WebApi.Security;

public enum AuthMode
{
    // Signed access tokens; X-TanPms-* headers are ignored.
    Jwt,

    // Trusts X-TanPms-* headers. Development/Testing only; the host refuses to start with it elsewhere.
    Headers
}
