import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { RateTariffTaxSection } from "@/features/rates/components/RateTariffTaxSection";
import {
  calculateHourlySimulationQuote,
  calculateUtilitySimulationQuote,
  calculateTaxSimulationQuote,
  roundMidpointAwayFromZero,
} from "@/features/rates/utils/calculators";
import {
  INITIAL_RATE_PLANS,
  INITIAL_UTILITY_TARIFFS,
  INITIAL_TAX_PROFILES,
} from "@/features/rates/constants";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("PM-03: Rate Plans, Utility Tariffs & Tax Rules UI & Calculations", () => {
  describe("Pure TS Calculators (Business Formula Verification)", () => {
    it("rounds numbers with MidpointRounding AwayFromZero correctly", () => {
      expect(roundMidpointAwayFromZero(10.555)).toBe(10.56);
      expect(roundMidpointAwayFromZero(10.554)).toBe(10.55);
      expect(roundMidpointAwayFromZero(0)).toBe(0);
    });

    it("calculates Hourly Stay correctly within base package and grace period", () => {
      const config = INITIAL_RATE_PLANS[0].hourlyPackage; // 3h = 450, +120/h, grace 15m, cap 1200
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
      const waterTariff = INITIAL_UTILITY_TARIFFS[0]; // 18/unit, min 100, digits 4

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
      const exemptProfile = INITIAL_TAX_PROFILES[0]; // Exempt, VAT 0%, default WHT 5%
      const vatIncProfile = INITIAL_TAX_PROFILES[1]; // VatIncluded, VAT 7%, WHT 0%
      const vatExcProfile = INITIAL_TAX_PROFILES[2]; // VatExcluded, VAT 7%, WHT 5%

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

  describe("UI Component Interactions (RateTariffTaxSection)", () => {
    it("renders Rate Plans table with column headers, KPI badges, and rates", () => {
      const { container } = renderWithIntl(<RateTariffTaxSection />);

      // Verify table thead
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();

      // Verify Column headers
      expect(screen.getByText(thMessages.admin.rates.colCodeName)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.colUnitType)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.colHourlyPackage)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.colDailyMonthly)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.colStatusModes)).toBeInTheDocument();

      // Verify initial Rate Plan codes
      expect(screen.getByText("RP-STD-2026")).toBeInTheDocument();
      expect(screen.getByText("RP-DLX-2026")).toBeInTheDocument();
      expect(screen.getByText("RP-SUT-2026")).toBeInTheDocument();
    });

    it("preserves Table-Preserved Architecture when rate plan filter finds no matches", () => {
      const { container } = renderWithIntl(<RateTariffTaxSection />);

      const searchInput = screen.getByPlaceholderText(
        thMessages.admin.rates.searchPlaceholder
      );
      fireEvent.change(searchInput, { target: { value: "NON-EXISTENT-PLAN-XYZ" } });

      // Table thead must still exist
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.colCodeName)).toBeInTheDocument();

      // Empty state text rendered
      expect(screen.getByText(thMessages.admin.rates.emptyRatePlans)).toBeInTheDocument();
    });

    it("switches tabs between Rate Plans, Utility Tariffs, and Tax Profiles", () => {
      renderWithIntl(<RateTariffTaxSection />);

      // Switch to Utility Tariffs tab
      const utilityTabButton = screen.getByText(thMessages.admin.rates.tabUtilityTariffs);
      fireEvent.click(utilityTabButton);

      // Verify Utility columns
      expect(screen.getByText(thMessages.admin.rates.colUtilityType)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.colBillingMode)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.waterType)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.electricType)).toBeInTheDocument();

      // Switch to Tax Profiles tab
      const taxTabButton = screen.getByText(thMessages.admin.rates.tabTaxProfiles);
      fireEvent.click(taxTabButton);

      // Verify Tax Profile columns & categories
      expect(screen.getByText(thMessages.admin.rates.colChargeCategory)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.colTaxMode)).toBeInTheDocument();
      expect(screen.getByText("MONTHLY_ROOM_RENT")).toBeInTheDocument();
      expect(screen.getByText("SHORT_STAY_ROOM")).toBeInTheDocument();
    });

    it("opens Rate Plan Create dialog with tabs and handles form interactions", () => {
      renderWithIntl(<RateTariffTaxSection />);

      const createButton = screen.getByText(thMessages.admin.rates.createRatePlan);
      fireEvent.click(createButton);

      // Modal Title should be displayed
      expect(screen.getByText(thMessages.admin.rates.modalTitleCreate)).toBeInTheDocument();

      // Tab navigation
      expect(screen.getByText(thMessages.admin.rates.formTabBasic)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.formTabHourly)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.formTabDailyMonthly)).toBeInTheDocument();

      // Switch to Hourly tab
      fireEvent.click(screen.getByText(thMessages.admin.rates.formTabHourly));
      expect(screen.getByText(thMessages.admin.rates.fieldBasePackageHours)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.fieldAutoCapToDailyRate)).toBeInTheDocument();
    });

    it("opens Interactive Quote & Tax Simulator and simulates in real time", () => {
      renderWithIntl(<RateTariffTaxSection />);

      const simButton = screen.getByText(thMessages.admin.rates.openSimulator);
      fireEvent.click(simButton);

      // Simulator Title
      expect(screen.getByText(thMessages.admin.rates.simTitle)).toBeInTheDocument();

      // Check for sections
      expect(screen.getByText(thMessages.admin.rates.simSectionHourly)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.simSectionUtility)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rates.simSectionTax)).toBeInTheDocument();

      // Verify Rollover warning is displayed when prev > curr and unconfirmed
      // (Default state in simulator is prev=9980, curr=15, confirmed=false)
      expect(screen.getByTestId("utility-rollover-warning")).toBeInTheDocument();

      // Confirm rollover
      const rolloverBtn = screen.getByText(`${thMessages.admin.rates.confirmRolloverLabel}: NO`);
      fireEvent.click(rolloverBtn);

      // Rollover warning should disappear
      expect(screen.queryByTestId("utility-rollover-warning")).not.toBeInTheDocument();
      expect(screen.getByText("(Rollover Applied)")).toBeInTheDocument();

      // Test duration input in Hourly section to trigger Auto-Cap
      const durationInput = screen.getByDisplayValue("195");
      fireEvent.change(durationInput, { target: { value: "800" } });

      // Notice should appear
      expect(screen.getByTestId("hourly-capped-notice")).toBeInTheDocument();
    });
  });
});
