namespace TanPms.Domain.DocumentNumbering;

public sealed record DocumentSequenceDefaults(
    DocumentTypeCode DocumentType,
    string Prefix,
    ResetPeriod ResetPeriod,
    int SequencePadding = 4);
