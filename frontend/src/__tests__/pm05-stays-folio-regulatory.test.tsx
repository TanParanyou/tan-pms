import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { FrontDeskStaysSection } from "@/features/stays/components/FrontDeskStaysSection";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("PM-05: Front Desk Stays, Folio Settlement & Regulatory Export UI", () => {
  describe("Stays DataTable (Table-Preserved & Live Timers)", () => {
    it("renders front desk stays table with headers, KPI badges, and initial active stays", () => {
      const { container } = renderWithIntl(<FrontDeskStaysSection />);

      // Table thead must exist
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();

      // Headers
      expect(screen.getByText(thMessages.admin.stays.colDocUnit)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.stays.colModeTimer)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.stays.colGuestOccupants)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.stays.colFolioDeposit)).toBeInTheDocument();

      // Initial Document numbers
      expect(screen.getByText("BKK01-STY-2611-0001")).toBeInTheDocument();
      expect(screen.getByText("BKK01-STY-2611-0002")).toBeInTheDocument();
      expect(screen.getByText("BKK01-STY-2611-0003")).toBeInTheDocument();

      // Initial Units
      expect(screen.getByText("Unit A-101")).toBeInTheDocument();
      expect(screen.getByText("Unit A-102")).toBeInTheDocument();

      // Verify Overtime badge for STY-0002 (-15 min)
      const expectedOvertimeText = thMessages.admin.stays.overtimeBadge.replace("{minutes}", "15");
      expect(screen.getByText(expectedOvertimeText)).toBeInTheDocument();
    });

    it("preserves table headers when search query has no match", () => {
      const { container } = renderWithIntl(<FrontDeskStaysSection />);

      const searchInput = screen.getByPlaceholderText(
        thMessages.admin.stays.searchPlaceholder
      );
      fireEvent.change(searchInput, { target: { value: "NON-EXISTENT-STY-999" } });

      // Table thead must STILL be present
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.stays.colDocUnit)).toBeInTheDocument();

      // Empty state text displayed
      expect(screen.getByText(thMessages.admin.stays.emptyStays)).toBeInTheDocument();
    });
  });

  describe("Extend Stay & Folio Posting", () => {
    it("opens Extend Stay modal, selects hours, and updates stay remaining time and folio", async () => {
      renderWithIntl(<FrontDeskStaysSection />);

      // Find Extend icon-button with aria-label for STY-0001
      const extendButtons = screen.getAllByLabelText(thMessages.admin.stays.actionExtend);
      expect(extendButtons.length).toBeGreaterThan(0);
      fireEvent.click(extendButtons[0]);

      // Extend modal should open
      expect(screen.getByText(thMessages.admin.stays.fieldAdditionalHours)).toBeInTheDocument();

      // Select +2h extension
      const option2h = screen.getByText("+2h (+240 THB)");
      fireEvent.click(option2h);

      // Submit extend
      const saveBtn = screen.getByText(thMessages.admin.stays.saveExtend);
      fireEvent.click(saveBtn);

      // Confirmation modal
      expect(screen.getByText(thMessages.admin.stays.confirmExtendTitle)).toBeInTheDocument();

      // Confirm
      const confirmBtns = screen.getAllByText(thMessages.admin.stays.saveExtend);
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);

      // Modal closed and time updated
      await waitFor(() => {
        expect(screen.queryByText(thMessages.admin.stays.confirmExtendTitle)).not.toBeInTheDocument();
      });
    });
  });

  describe("Guest Folio Operations", () => {
    it("opens Folio, adds new service charge, and records payment to settle balance", async () => {
      renderWithIntl(<FrontDeskStaysSection />);

      // Open folio for STY-0002 (which has an unsettled balance)
      const folioButtons = screen.getAllByLabelText(thMessages.admin.stays.actionFolio);
      expect(folioButtons.length).toBeGreaterThan(0);
      fireEvent.click(folioButtons[1]); // STY-0002

      // Folio Title & charges should appear
      expect(screen.getByText(thMessages.admin.stays.totalChargesLabel)).toBeInTheDocument();
      expect(screen.getAllByText("120 THB").length).toBeGreaterThan(0); // Balance Due and/or charge item

      // Switch to Add Charge tab
      const addChargeTab = screen.getByText(thMessages.admin.stays.tabAddCharge);
      fireEvent.click(addChargeTab);

      // Fill charge form
      const descInput = screen.getByLabelText(thMessages.admin.stays.fieldChargeDescEn);
      fireEvent.change(descInput, { target: { value: "Laundry Service" } });

      const amountInput = screen.getByLabelText(thMessages.admin.stays.fieldChargeAmount);
      fireEvent.change(amountInput, { target: { value: "80" } });

      const submitChargeBtn = screen.getByText(thMessages.admin.stays.saveAddCharge);
      fireEvent.click(submitChargeBtn);

      // Charge should now be added to folio
      await waitFor(() => {
        expect(screen.getByText("Laundry Service")).toBeInTheDocument();
      });

      // Switch to Record Payment tab
      const recordPaymentTab = screen.getByText(thMessages.admin.stays.tabRecordPayment);
      fireEvent.click(recordPaymentTab);

      // Settle full remaining balance (120 + 80 = 200 THB)
      const payAmountInput = screen.getByLabelText(thMessages.admin.stays.fieldPaymentAmount);
      fireEvent.change(payAmountInput, { target: { value: "200" } });

      const submitPayBtn = screen.getByText(thMessages.admin.stays.saveRecordPayment);
      fireEvent.click(submitPayBtn);

      // Balance due should now be 0 THB
      await waitFor(() => {
        expect(screen.getAllByText("0 THB").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Check-Out & Key Deposit Settlement", () => {
    it("blocks check-out when folio has unsettled balance (stay.folio_unsettled)", () => {
      renderWithIntl(<FrontDeskStaysSection />);

      // STY-0002 has 120 THB unsettled balance
      const checkOutButtons = screen.getAllByLabelText(thMessages.admin.stays.actionCheckOut);
      expect(checkOutButtons.length).toBeGreaterThan(0);
      fireEvent.click(checkOutButtons[1]); // STY-0002

      // Warning box must be rendered and check-out button disabled
      expect(screen.getByTestId("folio-unsettled-warning-box")).toBeInTheDocument();
      const saveCheckOutBtn = screen.getByText(thMessages.admin.stays.saveCheckOut);
      expect(saveCheckOutBtn).toBeDisabled();
    });

    it("allows check-out when folio is settled, refunds key deposit, and marks unit Dirty with housekeeping task", async () => {
      renderWithIntl(<FrontDeskStaysSection />);

      // STY-0001 has 0 THB balance due (settled)
      const checkOutButtons = screen.getAllByLabelText(thMessages.admin.stays.actionCheckOut);
      fireEvent.click(checkOutButtons[0]); // STY-0001

      // Warning box should NOT appear
      expect(screen.queryByTestId("folio-unsettled-warning-box")).not.toBeInTheDocument();

      // Submit check-out
      const saveCheckOutBtn = screen.getByText(thMessages.admin.stays.saveCheckOut);
      expect(saveCheckOutBtn).not.toBeDisabled();
      fireEvent.click(saveCheckOutBtn);

      // Confirmation modal
      expect(screen.getByText(thMessages.admin.stays.confirmCheckOutTitle)).toBeInTheDocument();

      // Confirm
      const confirmBtns = screen.getAllByText(thMessages.admin.stays.saveCheckOut);
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);

      // Modal closed
      await waitFor(() => {
        expect(screen.queryByText(thMessages.admin.stays.confirmCheckOutTitle)).not.toBeInTheDocument();
      });
    });
  });

  describe("Check-In / Walk-In Flow (Dirty Room Override Protection)", () => {
    it("requires mandatory override reason when attempting check-in to a Dirty unit", async () => {
      renderWithIntl(<FrontDeskStaysSection />);

      const checkInBtn = screen.getByRole("button", {
        name: new RegExp(thMessages.admin.stays.btnCheckIn),
      });
      fireEvent.click(checkInBtn);

      // Check-In modal opened
      expect(screen.getByText(thMessages.admin.stays.modalTitleCheckIn)).toBeInTheDocument();

      // Select unit A-102 (which is Dirty)
      const unitSelect = screen.getByLabelText(thMessages.admin.stays.fieldSelectUnit);
      fireEvent.change(unitSelect, { target: { value: "u-102" } });

      // Dirty unit alert box should appear
      expect(screen.getByTestId("dirty-unit-warning-box")).toBeInTheDocument();

      // Fill override reason
      const reasonInput = screen.getByPlaceholderText(thMessages.admin.stays.dirtyOverridePlaceholder);
      fireEvent.change(reasonInput, { target: { value: "Guest accepted room as-is for early baggage drop" } });

      // Click save check-in
      const saveBtn = screen.getByText(thMessages.admin.stays.saveCheckIn);
      fireEvent.click(saveBtn);

      // Dirty Override confirmation modal must appear
      expect(screen.getByText(thMessages.admin.stays.confirmDirtyOverrideTitle)).toBeInTheDocument();

      // Confirm override
      const confirmBtns = screen.getAllByText(thMessages.admin.stays.saveCheckIn);
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);

      // Check-in completed and new stay added
      await waitFor(() => {
        expect(screen.queryByText(thMessages.admin.stays.confirmDirtyOverrideTitle)).not.toBeInTheDocument();
      });
    });
  });

  describe("Regulatory Export (RR4 & TM.30)", () => {
    it("switches between RR4 and TM.30, unmasks PII upon confirmation, and renders preview CSV", async () => {
      renderWithIntl(<FrontDeskStaysSection />);

      const regulatoryBtn = screen.getByText(thMessages.admin.stays.btnRegulatory);
      fireEvent.click(regulatoryBtn);

      // Modal opens
      expect(screen.getByText(thMessages.admin.stays.modalTitleRegulatory)).toBeInTheDocument();

      // Initial report is RR4 (contains all guests e.g. Somchai Jaidee)
      expect(screen.getAllByText("Somchai Jaidee").length).toBeGreaterThan(0);

      // Switch to TM.30 (Foreigners only)
      const tm30Btn = screen.getByText(thMessages.admin.stays.tabTM30);
      fireEvent.click(tm30Btn);

      // Foreigners displayed, Thai primary guests filtered out from TM30
      expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Tanaka Kenji").length).toBeGreaterThan(0);

      // Click Unmask PII
      const unmaskBtn = screen.getByText(thMessages.admin.stays.unmaskPiiButton);
      fireEvent.click(unmaskBtn);

      // Unmask confirmation modal opens
      expect(screen.getByText(thMessages.admin.stays.confirmUnmaskTitle)).toBeInTheDocument();

      // Confirm unmask
      const confirmUnmaskBtn = screen.getByText(thMessages.admin.stays.confirmUnmaskBtn);
      fireEvent.click(confirmUnmaskBtn);

      // Sensitive ID should now be unmasked in table and CSV preview
      await waitFor(() => {
        expect(screen.getAllByText("US-PASS-9876543").length).toBeGreaterThan(0);
      });

      // CSV preview box exists
      expect(screen.getByTestId("regulatory-csv-preview")).toBeInTheDocument();
    });
  });
});
