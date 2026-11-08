namespace TanPms.Application.Common.Contracts;

public sealed record PdfDocumentDto(
    string FileName,
    byte[] Content);
