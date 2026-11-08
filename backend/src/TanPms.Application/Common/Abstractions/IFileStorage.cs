namespace TanPms.Application.Common.Abstractions;

// Private blob storage for uploaded files; keys are validated server-generated GUIDs (see StoredFileRules).
public interface IFileStorage
{
    void Save(string fileKey, byte[] content);

    Stream? OpenRead(string fileKey);
}
