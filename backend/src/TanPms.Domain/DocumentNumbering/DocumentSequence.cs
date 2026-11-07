namespace TanPms.Domain.DocumentNumbering;

public sealed class DocumentSequence
{
    public required Guid PropertyId { get; set; }
    public required string DocumentType { get; set; }
    public required string PeriodYyMm { get; set; }
    public int LastSequence { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
