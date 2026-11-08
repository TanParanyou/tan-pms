using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Common.Contracts;

// Body for Cancel/Void actions; the reason is mandatory because it is written to the audit log.
public sealed record ReasonRequest(
    string Reason)
{
    public Error? Validate() =>
        string.IsNullOrWhiteSpace(Reason)
            ? new Error(DomainErrorCodes.ValidationFailed, "Reason is required.")
            : null;
}
