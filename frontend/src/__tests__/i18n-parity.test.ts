import { describe, it, expect } from "vitest";
import thMessages from "@/messages/th.json";
import enMessages from "@/messages/en.json";

function getDeepKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getDeepKeys(value as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys.sort();
}

describe("Bilingual Localization Parity (th.json vs en.json)", () => {
  const thKeys = getDeepKeys(thMessages);
  const enKeys = getDeepKeys(enMessages);

  it("should have exactly the same key count and 100% identical key paths", () => {
    expect(thKeys).toEqual(enKeys);
  });

  it("should include all 20 Canonical Ubiquitous Language terms in both languages", () => {
    const requiredTerms = [
      "Property", "Building", "Floor", "UnitType", "Unit",
      "StayMode", "Customer", "Occupant", "Reservation", "Stay",
      "Folio", "Lease", "MeterReading", "Invoice", "Receipt",
      "CashierShift", "DepositLedger", "HousekeepingTask", "WorkOrder", "Parcel"
    ];

    for (const term of requiredTerms) {
      expect(thMessages.terms).toHaveProperty(term);
      expect(enMessages.terms).toHaveProperty(term);
    }
  });

  it("should include all 9 Document Numbering prefixes in both languages", () => {
    const requiredPrefixes = [
      "RES", "STY", "LSE", "INV", "RCT", "DEP", "SHF", "WKO", "PCL"
    ];

    for (const prefix of requiredPrefixes) {
      expect(thMessages.documents).toHaveProperty(prefix);
      expect(enMessages.documents).toHaveProperty(prefix);
    }
  });

  it("should include all RFC 9457 error codes in both languages", () => {
    const requiredErrorKeys = [
      "validation_failed",
      "auth_unauthenticated",
      "auth_property_scope_denied",
      "auth_permission_denied",
      "unit_not_clean",
      "reservation_slot_overlap",
      "reservation_quota_exhausted",
      "reservation_hold_expired",
      "stay_folio_unsettled",
      "invoice_immutable_status",
      "shift_not_open",
      "meter_rollover_unconfirmed"
    ];

    for (const errKey of requiredErrorKeys) {
      expect(thMessages.errors).toHaveProperty(errKey);
      expect(enMessages.errors).toHaveProperty(errKey);
    }
  });
});
