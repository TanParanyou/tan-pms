import { describe, it, expect } from "vitest";
import {
  calculateHourlySimulationQuote,
  calculateUtilitySimulationQuote,
  calculateTaxSimulationQuote,
  roundMidpointAwayFromZero,
} from "@/features/rates/utils/calculators";

import type { HourlyPackageConfigDto, UtilityTariffItemDto, TaxProfileItemDto } from "@/generated/api";

// Pure formula fixtures (no sample catalog data in production code).
const HOURLY: HourlyPackageConfigDto = {
  basePackageHours: 3,
  basePackagePrice: 450,
  additionalHourPrice: 120,
  gracePeriodMinutes: 15,
  autoCapToDailyRate: 1200,
  turnaroundBufferMinutes: 30,
};
const WATER_TARIFF: UtilityTariffItemDto = {
  id: "t-water",
  utilityType: "Water",
  name: { th: "ค่าน้ำ", en: "Water" },
  billingMode: "PerUnit",
  ratePerUnit: 18,
  minimumChargeAmount: 100,
  includedUnits: 0,
  baseMinimumAmount: 0,
  flatRateAmount: 0,
  flatRatePerOccupant: false,
  meterMaxDigits: 4,
};
const taxProfile = (id: string, taxMode: TaxProfileItemDto["taxMode"], vat: number, wht: number): TaxProfileItemDto => ({
  id,
  chargeCategoryCode: id,
  name: { th: id, en: id },
  taxMode,
  vatRatePercent: vat,
  defaultWithholdingTaxPercent: wht,
  isActive: true,
});
const TAX_PROFILES = [taxProfile("rent", "Exempt", 0, 5), taxProfile("short", "VatIncluded", 7, 0), taxProfile("furniture", "VatExcluded", 7, 5)];

describe("PM-03: Rate Plans, Utility Tariffs & Tax Rules UI & Calculations", () => {
  describe("Pure TS Calculators (Business Formula Verification)", () => {
    it("rounds numbers with MidpointRounding AwayFromZero correctly", () => {
      expect(roundMidpointAwayFromZero(10.555)).toBe(10.56);
      expect(roundMidpointAwayFromZero(10.554)).toBe(10.55);
      expect(roundMidpointAwayFromZero(0)).toBe(0);
    });

    it("calculates Hourly Stay correctly within base package and grace period", () => {
      const config = HOURLY; // 3h = 450, +120/h, grace 15m, cap 1200
      // Case 1: 180 min (exact 3 hours)
      const q1 = calculateHourlySimulationQuote(180, config);
      expect(q1.extraHours).toBe(0);
      expect(q1.rawCharge).toBe(450);
      expect(q1.finalHourlyRoomCharge).toBe(450);
      expect(q1.isCappedToDailyRate).toBe(false);

      // Case 2: 195 min (within 15m grace)
      const q2 = calculateHourlySimulationQuote(195, config);
      expect(q2.extraHours).toBe(0);
      expect(q2.rawCharge).toBe(450);
      expect(q2.finalHourlyRoomCharge).toBe(450);
      expect(q2.isCappedToDailyRate).toBe(false);

      // Case 3: 196 min (1 min past grace -> 1 extra hour)
      const q3 = calculateHourlySimulationQuote(196, config);
      expect(q3.extraHours).toBe(1);
      expect(q3.rawCharge).toBe(570); // 450 + 120
      expect(q3.finalHourlyRoomCharge).toBe(570);
      expect(q3.isCappedToDailyRate).toBe(false);

      // Case 4: 600 min (10 hours -> exceeds cap 1200)
      // excess = 600 - (180 + 15) = 405 min -> ceil(405/60) = 7 extra hours
      // raw = 450 + 7 * 120 = 1290 -> capped to 1200
      const q4 = calculateHourlySimulationQuote(600, config);
      expect(q4.extraHours).toBe(7);
      expect(q4.rawCharge).toBe(1290);
      expect(q4.isCappedToDailyRate).toBe(true);
      expect(q4.finalHourlyRoomCharge).toBe(1200);
    });

    it("calculates Utility Meter usage and rollovers with confirmation rules", () => {
      const waterTariff = WATER_TARIFF; // 18/unit, min 100, digits 4

      // Normal usage (curr >= prev)
      const normalQuote = calculateUtilitySimulationQuote(
        "Water",
        100,
        120,
        false,
        waterTariff
      );
      expect(normalQuote.usageUnits).toBe(20);
      expect(normalQuote.chargeAmount).toBe(360); // 20 * 18 = 360 > min 100
      expect(normalQuote.usedRollover).toBe(false);
      expect(normalQuote.isRolloverUnconfirmed).toBe(false);

      // Rollover unconfirmed (curr < prev, rollover = false)
      const unconfirmedQuote = calculateUtilitySimulationQuote(
        "Water",
        9980,
        15,
        false,
        waterTariff
      );
      expect(unconfirmedQuote.usageUnits).toBe(0);
      expect(unconfirmedQuote.chargeAmount).toBe(0);
      expect(unconfirmedQuote.isRolloverUnconfirmed).toBe(true);

      // Rollover confirmed (curr < prev, rollover = true)
      // 4 digits capacity = 10,000 -> (10,000 - 9980) + 15 = 35 units
      const confirmedQuote = calculateUtilitySimulationQuote(
        "Water",
        9980,
        15,
        true,
        waterTariff
      );
      expect(confirmedQuote.usageUnits).toBe(35);
      expect(confirmedQuote.chargeAmount).toBe(630); // 35 * 18 = 630
      expect(confirmedQuote.usedRollover).toBe(true);
      expect(confirmedQuote.isRolloverUnconfirmed).toBe(false);
    });

    it("calculates Thai Tax Rules (Exempt, VatIncluded, VatExcluded, and WHT)", () => {
      const exemptProfile = TAX_PROFILES[0]; // Exempt, VAT 0%, default WHT 5%
      const vatIncProfile = TAX_PROFILES[1]; // VatIncluded, VAT 7%, WHT 0%
      const vatExcProfile = TAX_PROFILES[2]; // VatExcluded, VAT 7%, WHT 5%

      // 1. Exempt (e.g. Monthly Room Rent 10,000 THB with 5% WHT)
      const exemptTax = calculateTaxSimulationQuote(10000, exemptProfile, true);
      expect(exemptTax.subTotal).toBe(10000);
      expect(exemptTax.vatAmount).toBe(0);
      expect(exemptTax.invoiceTotal).toBe(10000);
      expect(exemptTax.withholdingTaxAmount).toBe(500); // 5% of 10,000
      expect(exemptTax.netPayable).toBe(9500);

      // 2. VatIncluded (e.g. 1070 THB total -> subtotal 1000, VAT 70)
      const vatIncTax = calculateTaxSimulationQuote(1070, vatIncProfile, false);
      expect(vatIncTax.invoiceTotal).toBe(1070);
      expect(vatIncTax.subTotal).toBe(1000);
      expect(vatIncTax.vatAmount).toBe(70);
      expect(vatIncTax.netPayable).toBe(1070);

      // 3. VatExcluded (e.g. Furniture Rental 2000 THB with 7% VAT and 5% WHT)
      const vatExcTax = calculateTaxSimulationQuote(2000, vatExcProfile, true);
      expect(vatExcTax.subTotal).toBe(2000);
      expect(vatExcTax.vatAmount).toBe(140); // 2000 * 0.07
      expect(vatExcTax.invoiceTotal).toBe(2140);
      expect(vatExcTax.withholdingTaxAmount).toBe(100); // 5% of 2000 (pre-vat)
      expect(vatExcTax.netPayable).toBe(2040); // 2140 - 100
    });
  });
});
