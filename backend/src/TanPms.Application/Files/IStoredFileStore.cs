using TanPms.Application.Common.Results;
using TanPms.Domain.Files;

namespace TanPms.Application.Files;

public interface IStoredFileStore
{
    Result<StoredFileDto> AddStoredFile(StoredFile file);

    StoredFile? FindStoredFile(string fileKey);

    // Properties of the slips, work orders, parcels, meter readings or reservations that reference the key.
    IReadOnlyList<Guid> FindFileAttachmentPropertyIds(string fileKey);

    // True when the key is attached to the customer's own slip, work order, parcel or reservation.
    bool IsFileAttachedToCustomer(string fileKey, Guid customerId);
}
