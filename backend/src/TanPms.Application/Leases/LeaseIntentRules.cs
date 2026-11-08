using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Leases;

namespace TanPms.Application.Leases;

// Shared lease-intent validation and in-app notification text for both persistence providers.
public static class LeaseIntentRules
{
    public const string ClientCreateActionKey = "client.lease_intents.create";
    public const string ClientUpdateActionKey = "client.lease_intents.update";
    public const string ClientWithdrawActionKey = "client.lease_intents.withdraw";
    public const string ApprovedTemplateKey = "lease.intent_approved";
    public const string RejectedTemplateKey = "lease.intent_rejected";

    public static Error? ParseType(string? intentType, out LeaseIntentType parsed)
    {
        parsed = default;
        return string.IsNullOrWhiteSpace(intentType)
            || int.TryParse(intentType, out _)
            || !Enum.TryParse(intentType, ignoreCase: true, out parsed)
            || !Enum.IsDefined(parsed)
                ? Invalid($"Invalid lease intent type '{intentType}'.")
                : null;
    }

    public static Error? ParseStatus(string? status, out LeaseIntentStatus? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        if (int.TryParse(status, out _) || !Enum.TryParse<LeaseIntentStatus>(status, ignoreCase: true, out var value) || !Enum.IsDefined(value))
        {
            return Invalid($"Invalid lease intent status '{status}'.");
        }

        parsed = value;
        return null;
    }

    // Renew must extend past the current end date; a move-out date must fall between today and the lease end date.
    public static Error? ValidateDesiredDate(Lease lease, LeaseIntentType intentType, DateOnly desiredDate, DateOnly today) =>
        intentType == LeaseIntentType.Renew
            ? desiredDate <= lease.EndDate ? Invalid("Desired renewal end date must be after the current lease end date.") : null
            : desiredDate < today || desiredDate > lease.EndDate
                ? Invalid("Desired move-out date must be between today and the lease end date.")
                : null;

    public static Error? CheckLeaseAcceptsIntent(Lease? lease, Guid customerId)
    {
        if (lease is null || lease.CustomerId != customerId)
        {
            return new Error(DomainErrorCodes.PermissionDenied, "Lease was not found for the current customer.");
        }

        return lease.Status == LeaseStatus.Active
            ? null
            : Invalid($"Lease {lease.DocumentNumber} must be Active to submit an intent (current: {lease.Status}).");
    }

    public static Error ClientIntentNotFound() =>
        new(DomainErrorCodes.PermissionDenied, "Lease intent was not found for the current customer.");

    public static Error IntentNotFound(Guid propertyId, Guid intentId) =>
        Invalid($"Lease intent '{intentId}' was not found in property '{propertyId}'.");

    public static Error PendingIntentExists(string leaseDocumentNumber) =>
        Invalid($"Lease {leaseDocumentNumber} already has a Pending intent; edit or withdraw it instead.");

    public static LocalizedText NotificationTitle(LeaseIntentRequest intent, string leaseDocumentNumber) =>
        intent.Status == LeaseIntentStatus.Approved
            ? LocalizedText.Create($"อนุมัติคำขอ{ThaiType(intent)} {leaseDocumentNumber}", $"{EnglishType(intent)} request approved ({leaseDocumentNumber})")
            : LocalizedText.Create($"ไม่อนุมัติคำขอ{ThaiType(intent)} {leaseDocumentNumber}", $"{EnglishType(intent)} request rejected ({leaseDocumentNumber})");

    public static LocalizedText NotificationBody(LeaseIntentRequest intent) =>
        intent.Status == LeaseIntentStatus.Approved
            ? LocalizedText.Create(
                $"คำขอวันที่ {intent.DesiredDate:yyyy-MM-dd} ได้รับการอนุมัติแล้ว",
                $"Your request for {intent.DesiredDate:yyyy-MM-dd} was approved.")
            : LocalizedText.Create(
                $"เหตุผล: {intent.RejectReason}",
                $"Reason: {intent.RejectReason}",
                maxLength: 1000);

    private static string ThaiType(LeaseIntentRequest intent) =>
        intent.IntentType == LeaseIntentType.Renew ? "ต่อสัญญา" : "ย้ายออก";

    private static string EnglishType(LeaseIntentRequest intent) =>
        intent.IntentType == LeaseIntentType.Renew ? "Lease renewal" : "Move-out";

    private static Error Invalid(string message) => new(DomainErrorCodes.ValidationFailed, message);
}
