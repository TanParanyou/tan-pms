namespace TanPms.Application.Billing;

public static class BatchInvoiceSkipReasons
{
    public const string InvoiceAlreadyExists = "billing.invoice_exists";
    public const string MissingMeterReadings = "billing.missing_meter_readings";
}
