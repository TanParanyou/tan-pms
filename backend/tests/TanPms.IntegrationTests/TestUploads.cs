using System.Net.Http.Headers;
using System.Net.Http.Json;
using TanPms.Application.Files;

namespace TanPms.IntegrationTests;

// Multipart helpers for the authorized file endpoints.
internal static class TestUploads
{
    internal static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];

    internal static async Task<HttpResponseMessage> PostAsync(HttpClient client, string url, string purpose, Guid? propertyId = null, byte[]? content = null)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content ?? Png);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "file", "upload.png");
        form.Add(new StringContent(purpose), "purpose");
        if (propertyId.HasValue)
        {
            form.Add(new StringContent(propertyId.Value.ToString()), "propertyId");
        }

        return await client.PostAsync(url, form);
    }

    internal static async Task<string> AdminAsync(HttpClient client, string purpose, Guid propertyId)
    {
        var res = await PostAsync(client, "/api/v1/admin/files", purpose, propertyId);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<StoredFileDto>())!.FileKey;
    }

    internal static async Task<string> ClientAsync(HttpClient client, string purpose)
    {
        var res = await PostAsync(client, "/api/v1/client/files", purpose);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<StoredFileDto>())!.FileKey;
    }
}
