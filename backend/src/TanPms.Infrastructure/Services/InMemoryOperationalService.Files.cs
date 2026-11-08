using TanPms.Application.Common.Results;
using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    private readonly List<StoredFile> _storedFiles = [];

    public Result<StoredFileDto> AddStoredFile(StoredFile file)
    {
        lock (_syncRoot)
        {
            _storedFiles.Add(file);
            return Result<StoredFileDto>.Success(StoredFileRules.Map(file));
        }
    }

    public StoredFile? FindStoredFile(string fileKey)
    {
        lock (_syncRoot)
        {
            return _storedFiles.FirstOrDefault(f => f.FileKey == fileKey);
        }
    }

    public IReadOnlyList<Guid> FindFileAttachmentPropertyIds(string fileKey)
    {
        lock (_syncRoot)
        {
            return _paymentSlips.Where(s => s.SlipFileKey == fileKey).Select(s => s.PropertyId)
                .Concat(_workOrders.Where(w => w.BeforePhotoFileKey == fileKey || w.AfterPhotoFileKey == fileKey).Select(w => w.PropertyId))
                .Concat(_parcels.Where(p => p.ParcelPhotoFileKey == fileKey).Select(p => p.PropertyId))
                .Concat(_meterReadings.Where(r => r.PhotoFileKey == fileKey).Select(r => r.PropertyId))
                .Concat(_reservations.Where(r => r.PaymentSlipFileKey == fileKey).Select(r => r.PropertyId))
                .Distinct()
                .ToList();
        }
    }

    public bool IsFileAttachedToCustomer(string fileKey, Guid customerId)
    {
        lock (_syncRoot)
        {
            return _paymentSlips.Any(s => s.SlipFileKey == fileKey && s.CustomerId == customerId)
                || _workOrders.Any(w => (w.BeforePhotoFileKey == fileKey || w.AfterPhotoFileKey == fileKey) && w.ReportedByCustomerId == customerId)
                || _parcels.Any(p => p.ParcelPhotoFileKey == fileKey && p.CustomerId == customerId)
                || _reservations.Any(r => r.PaymentSlipFileKey == fileKey && r.CustomerId == customerId);
        }
    }
}
