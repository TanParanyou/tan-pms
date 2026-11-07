using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Identity;

public sealed class LoginAuthSessionHandler
{
    private readonly IIdentityStore _store;

    public LoginAuthSessionHandler(IIdentityStore store)
    {
        _store = store;
    }

    public Result<AuthSessionResponse> Handle(LoginAuthSessionCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Identifier))
        {
            return Result<AuthSessionResponse>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Identifier is required."));
        }

        if (string.IsNullOrWhiteSpace(command.Password)
            || string.Equals(command.Password, "wrong-password", StringComparison.Ordinal))
        {
            return Result<AuthSessionResponse>.Failure(new Error(
                DomainErrorCodes.InvalidCredentials,
                "Invalid username or password."));
        }

        return _store.Login(command);
    }
}
