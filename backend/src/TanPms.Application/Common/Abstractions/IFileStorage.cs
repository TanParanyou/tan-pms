namespace TanPms.Application.Common.Abstractions;

public interface IFileStorage
{
    Task<string> UploadAsync(
        string objectKeyPrefix,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default);
}
