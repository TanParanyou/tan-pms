using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

public sealed record BatchInvoiceSkipDto(
    Guid LeaseId,
    string LeaseDocumentNumber,
    UnitRefDto Unit,
    string ReasonCode);
