using TanPms.Application.Identity;

namespace TanPms.Application.Common.Abstractions;

public interface IAccessTokenIssuer
{
    AccessTokenResult Issue(string subjectId, string scope);
}
