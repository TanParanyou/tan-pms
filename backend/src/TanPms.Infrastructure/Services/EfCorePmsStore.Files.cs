using Microsoft.EntityFrameworkCore;
using TanPms.Application.Common.Results;
using TanPms.Application.Files;
using TanPms.Domain.Files;

namespace TanPms.Infrastructure.Services;

public sealed partial class EfCorePmsStore
{
    public Result<StoredFileDto> AddStoredFile(StoredFile file)
    {
        _dbContext.StoredFiles.Add(file);
        _dbContext.SaveChanges();
        return Result<StoredFileDto>.Success(StoredFileRules.Map(file));
    }

    public StoredFile? FindStoredFile(string fileKey) =>
        _dbContext.StoredFiles.AsNoTracking().FirstOrDefault(f => f.FileKey == fileKey);

    public IReadOnlyList<Guid> FindFileAttachmentPropertyIds(string fileKey) =>
        _dbContext.PaymentSlips.AsNoTracking().Where(s => s.SlipFileKey == fileKey).Select(s => s.PropertyId)
            .Concat(_dbContext.WorkOrders.AsNoTracking()
                .Where(w => w.BeforePhotoFileKey == fileKey || w.AfterPhotoFileKey == fileKey).Select(w => w.PropertyId))
            .Concat(_dbContext.Parcels.AsNoTracking().Where(p => p.ParcelPhotoFileKey == fileKey).Select(p => p.PropertyId))
            .Concat(_dbContext.MeterReadings.AsNoTracking().Where(r => r.PhotoFileKey == fileKey).Select(r => r.PropertyId))
            .Concat(_dbContext.Reservations.AsNoTracking().Where(r => r.PaymentSlipFileKey == fileKey).Select(r => r.PropertyId))
            .Distinct()
            .ToList();

    public bool IsFileAttachedToCustomer(string fileKey, Guid customerId) =>
        _dbContext.PaymentSlips.AsNoTracking().Any(s => s.SlipFileKey == fileKey && s.CustomerId == customerId)
        || _dbContext.WorkOrders.AsNoTracking().Any(w =>
            (w.BeforePhotoFileKey == fileKey || w.AfterPhotoFileKey == fileKey) && w.ReportedByCustomerId == customerId)
        || _dbContext.Parcels.AsNoTracking().Any(p => p.ParcelPhotoFileKey == fileKey && p.CustomerId == customerId)
        || _dbContext.Reservations.AsNoTracking().Any(r => r.PaymentSlipFileKey == fileKey && r.CustomerId == customerId);
}
