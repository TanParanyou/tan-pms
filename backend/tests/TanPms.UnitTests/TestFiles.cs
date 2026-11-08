using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.UnitTests;

// Registers StoredFile metadata so write handlers accept the key (bytes are irrelevant to these tests).
internal static class TestFiles
{
    internal static string Admin(IStoredFileStore store, StoredFilePurpose purpose, Guid propertyId) =>
        Register(store, purpose, propertyId, customerId: null);

    internal static string Client(IStoredFileStore store, StoredFilePurpose purpose, Guid customerId) =>
        Register(store, purpose, propertyId: null, customerId);

    private static string Register(IStoredFileStore store, StoredFilePurpose purpose, Guid? propertyId, Guid? customerId) =>
        store.AddStoredFile(new StoredFile
        {
            FileKey = StoredFileRules.NewFileKey(),
            Purpose = purpose,
            ContentType = "image/jpeg",
            SizeBytes = 3,
            PropertyId = propertyId,
            UploadedByUserId = propertyId.HasValue ? "test-user" : null,
            UploadedByCustomerId = customerId
        }).Value!.FileKey;
}
