namespace TanPms.Application.Stays;

public sealed record CheckOutStayRequest(
    decimal KeyDepositDeductionAmount,
    string DeductionOrRefundReason);
