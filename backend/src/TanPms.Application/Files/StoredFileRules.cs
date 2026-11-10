using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Files;
using TanPms.Domain.Identity;

namespace TanPms.Application.Files;

// Upload validation, purpose permissions and attachment checks shared by handlers and both persistence providers.
public static class StoredFileRules
{
    public const long MaxSizeBytes = 10 * 1024 * 1024;
    public const string AdminUploadActionKey = "admin.files.upload";
    public const string ClientUploadActionKey = "client.files.upload";

    public static readonly IReadOnlySet<StoredFilePurpose> ClientPurposes =
        new HashSet<StoredFilePurpose> { StoredFilePurpose.PaymentSlip, StoredFilePurpose.WorkOrderPhoto };

    // Admin may upload a purpose when holding any permission of the feature that consumes it.
    public static string[] AdminPermissionsFor(StoredFilePurpose purpose) => purpose switch
    {
        StoredFilePurpose.MeterPhoto => [PermissionKeys.AdminMetersRecord],
        StoredFilePurpose.PaymentSlip => [PermissionKeys.AdminPaymentsVerifySlip, PermissionKeys.AdminCashierOperateShift],
        StoredFilePurpose.WorkOrderPhoto => [PermissionKeys.AdminWorkOrdersManage],
        StoredFilePurpose.ParcelPhoto => [PermissionKeys.AdminParcelsManage],
        StoredFilePurpose.LeaseInspectionPhoto => [PermissionKeys.AdminLeasesManage, PermissionKeys.AdminLeasesSettleMoveOut],
        StoredFilePurpose.IdentityDocument => [PermissionKeys.AdminLeasesManage, PermissionKeys.AdminStayCheckIn],
        _ => []
    };

    public static Error? ParsePurpose(string? purpose, out StoredFilePurpose parsed)
    {
        parsed = default;
        return string.IsNullOrWhiteSpace(purpose)
            || !Enum.TryParse(purpose, ignoreCase: true, out parsed)
            || !Enum.IsDefined(parsed)
            || int.TryParse(purpose, out _)
                ? Invalid($"Invalid file purpose '{purpose}'.")
                : null;
    }

    // Reads at most MaxSizeBytes + 1 bytes so an oversized upload is rejected without buffering all of it.
    public static Error? ReadContent(Stream content, out byte[] bytes, out string contentType)
    {
        contentType = string.Empty;
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = content.Read(chunk, 0, chunk.Length)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > MaxSizeBytes)
            {
                bytes = [];
                return Invalid("File exceeds the 10 MB limit.");
            }
        }

        bytes = buffer.ToArray();
        if (bytes.Length == 0)
        {
            return Invalid("File is empty.");
        }

        var detected = DetectContentType(bytes);
        if (detected is null)
        {
            return Invalid("Only JPEG, PNG, WebP or PDF files are accepted.");
        }

        contentType = detected;
        return null;
    }

    // Content type comes from magic bytes only; the client-declared type is never trusted.
    public static string? DetectContentType(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (bytes.Length >= 8 && bytes[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return "image/png";
        }

        if (bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes[8..12].SequenceEqual("WEBP"u8))
        {
            return "image/webp";
        }

        return bytes.Length >= 5 && bytes[..5].SequenceEqual("%PDF-"u8) ? "application/pdf" : null;
    }

    public static string NewFileKey() => Guid.NewGuid().ToString("N");

    // Keys are 32 lowercase hex chars, so a key can never contain path separators or "..".
    public static bool IsValidFileKey(string? fileKey) =>
        fileKey is { Length: 32 }
        && Guid.TryParseExact(fileKey, "N", out _)
        && fileKey.All(c => char.IsDigit(c) || c is >= 'a' and <= 'f');

    // Validates every non-empty key a write handler is about to store. Null/empty stays allowed (backward compatible).
    // Admin writes accept files uploaded for the same property, or client uploads (not property-bound);
    // client writes accept only files the same customer uploaded.
    public static Error? ValidateAttachments(
        IStoredFileStore files,
        StoredFilePurpose purpose,
        Guid? propertyId,
        Guid? customerId,
        params string?[] fileKeys)
    {
        foreach (var key in fileKeys)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var file = IsValidFileKey(key.Trim()) ? files.FindStoredFile(key.Trim()) : null;
            if (file is null)
            {
                return Invalid($"File '{key}' was not uploaded through the file endpoint.");
            }

            if (file.Purpose != purpose)
            {
                return Invalid($"File '{key}' was uploaded for {file.Purpose}, not {purpose}.");
            }

            var allowed = customerId.HasValue
                ? file.UploadedByCustomerId == customerId
                : file.PropertyId == propertyId || (file.PropertyId is null && file.UploadedByCustomerId.HasValue);
            if (!allowed)
            {
                return new Error(DomainErrorCodes.PermissionDenied, $"File '{key}' belongs to another owner.");
            }
        }

        return null;
    }

    // Legacy keys (e.g. "slips/x.jpg" written before the file service existed) are reported as not found, never as a 500.
    public static Error FileNotFound(string fileKey) =>
        new(DomainErrorCodes.FileNotFound, IsValidFileKey(fileKey)
            ? $"File '{fileKey}' was not found."
            : $"File key '{fileKey}' is a legacy key that cannot be downloaded through the file service.");

    public static StoredFileDto Map(StoredFile file) =>
        new(file.FileKey, file.Purpose.ToString(), file.ContentType, file.SizeBytes, file.CreatedAt);

    private static Error Invalid(string message) => new(DomainErrorCodes.ValidationFailed, message);
}
