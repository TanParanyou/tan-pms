import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AdminReservationsSection } from "@/features/reservations/components/AdminReservationsSection";
import { ClientBookingSection } from "@/features/reservations/components/ClientBookingSection";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { renderAdmin } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin",
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("PM-04: Unified Availability, Reservations & Booking Hold UI", () => {
  describe("Admin Reservations Section (Table-Preserved, Actions & Modals)", () => {
    it("renders reservations table with headers, KPI badges, and initial records", () => {
      const { container } = renderWithIntl(<AdminReservationsSection />);

      // Verify thead exists
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();

      // Verify column headers
      expect(screen.getByText(thMessages.admin.reservations.colDocument)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.reservations.colCustomer)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.reservations.colStayModeSlot)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.reservations.colUnitTypeUnit)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.reservations.colStatusDeposit)).toBeInTheDocument();

      // Verify initial document numbers
      expect(screen.getByText("BKK01-RES-2611-0001")).toBeInTheDocument();
      expect(screen.getByText("BKK01-RES-2611-0002")).toBeInTheDocument();
      expect(screen.getByText("BKK01-RES-2611-0003")).toBeInTheDocument();

      // Verify customer names
      expect(screen.getByText("Somchai Jaidee")).toBeInTheDocument();
      expect(screen.getByText("Vipaporn Kaewmanee")).toBeInTheDocument();
    });

    it("preserves Table-Preserved thead when search query finds no matches", () => {
      const { container } = renderWithIntl(<AdminReservationsSection />);

      const searchInput = screen.getByPlaceholderText(
        thMessages.admin.reservations.searchPlaceholder
      );
      fireEvent.change(searchInput, { target: { value: "RES-NON-EXISTENT-999" } });

      // Table thead must STILL be present
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.reservations.colDocument)).toBeInTheDocument();

      // Empty state text displayed
      expect(screen.getByText(thMessages.admin.reservations.emptyReservations)).toBeInTheDocument();
    });

    it("opens Assign Unit modal, selects a clean physical unit, and confirms assignment", async () => {
      renderWithIntl(<AdminReservationsSection />);

      // RES-0002 has no assigned unit
      const assignButtons = screen.getAllByText(
        thMessages.admin.reservations.actionAssignUnit
      );
      expect(assignButtons.length).toBeGreaterThan(0);
      fireEvent.click(assignButtons[0]);

      // Assign Modal Header
      expect(screen.getByText(thMessages.admin.reservations.selectUnitLabel)).toBeInTheDocument();

      // Submit form to trigger confirmation
      const saveBtn = screen.getByText(thMessages.admin.reservations.saveAssign);
      fireEvent.click(saveBtn);

      // Confirmation Modal should appear
      expect(screen.getByText(thMessages.admin.reservations.confirmAssignTitle)).toBeInTheDocument();

      // Confirm assignment
      const confirmActions = screen.getAllByText(thMessages.admin.reservations.saveAssign);
      fireEvent.click(confirmActions[confirmActions.length - 1]);

      // Unit number should now be assigned
      await waitFor(() => {
        expect(screen.getByText("Unit A-201")).toBeInTheDocument();
      });
    });

    it("approves pending reservation and changes status to Confirmed", async () => {
      renderWithIntl(<AdminReservationsSection />);

      // Find Confirm button for Hold/Pending verification
      const confirmButtons = screen.getAllByText(
        thMessages.admin.reservations.actionConfirm
      );
      expect(confirmButtons.length).toBeGreaterThan(0);
      fireEvent.click(confirmButtons[0]);

      // Confirmation dialog opens
      expect(screen.getByText(thMessages.admin.reservations.confirmModalTitle)).toBeInTheDocument();

      // Click confirm action
      const confirmActions = screen.getAllByText(thMessages.admin.reservations.actionConfirm);
      fireEvent.click(confirmActions[confirmActions.length - 1]);

      // Status should become Confirmed
      await waitFor(() => {
        const confirmedBadges = screen.getAllByText("Confirmed");
        expect(confirmedBadges.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("cancels reservation with mandatory audit justification reason", async () => {
      renderWithIntl(<AdminReservationsSection />);

      const cancelButtons = screen.getAllByText(
        thMessages.admin.reservations.actionCancel
      );
      expect(cancelButtons.length).toBeGreaterThan(0);
      fireEvent.click(cancelButtons[0]);

      // Cancel Dialog opens
      expect(screen.getByPlaceholderText(thMessages.admin.reservations.reasonPlaceholder)).toBeInTheDocument();

      // Fill reason
      const reasonInput = screen.getByPlaceholderText(thMessages.admin.reservations.reasonPlaceholder);
      fireEvent.change(reasonInput, { target: { value: "Guest requested cancellation via phone" } });

      // Click save cancel
      const saveCancelBtn = screen.getByText(thMessages.admin.reservations.saveCancel);
      fireEvent.click(saveCancelBtn);

      // Confirmation modal opens
      expect(screen.getByText(thMessages.admin.reservations.confirmCancelTitle)).toBeInTheDocument();

      // Confirm
      const finalConfirmActions = screen.getAllByText(thMessages.admin.reservations.saveCancel);
      fireEvent.click(finalConfirmActions[finalConfirmActions.length - 1]);

      await waitFor(() => {
        expect(screen.getByText("Cancelled")).toBeInTheDocument();
      });
    });

    it("opens Availability Inspector and displays 3-mode net available quotas", () => {
      renderWithIntl(<AdminReservationsSection />);

      const inspectorBtn = screen.getByText(thMessages.admin.reservations.inspectAvailability);
      fireEvent.click(inspectorBtn);

      // Inspector Title
      expect(screen.getByText(thMessages.admin.reservations.modalTitleInspector)).toBeInTheDocument();
      expect(screen.getByText("5 rooms")).toBeInTheDocument();
      expect(screen.getByText("3 rooms")).toBeInTheDocument();
    });
  });

  describe("Client Booking Section (real availability and hold)", () => {
    const availability = {
      property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
      stayMode: "Daily" as const,
      slotStartAt: "2026-11-20T07:00:00Z",
      slotEndAt: "2026-11-22T05:00:00Z",
      items: [
        {
          unitType: { id: "ut1", code: "STD", name: { th: "สแตนดาร์ด", en: "Standard" }, areaSqm: 32 },
          supportedStayModes: ["Daily" as const],
          totalPhysicalUnits: 5,
          unassignedQuotaHeld: 0,
          netAvailableQuota: 3,
          turnaroundBufferMinutes: 0,
          estimatedRoomRate: 1200,
          estimatedDepositAmount: 500,
          availableUnits: [],
        },
        {
          unitType: { id: "ut2", code: "DLX", name: { th: "ดีลักซ์", en: "Deluxe" }, areaSqm: 40 },
          supportedStayModes: ["Daily" as const],
          totalPhysicalUnits: 2,
          unassignedQuotaHeld: 0,
          netAvailableQuota: 0,
          turnaroundBufferMinutes: 0,
          estimatedRoomRate: 2000,
          estimatedDepositAmount: 800,
          availableUnits: [],
        },
      ],
    };

    afterEach(() => vi.restoreAllMocks());

    const search = async () => {
      fireEvent.change(document.getElementById("book-checkin") as HTMLInputElement, { target: { value: "2026-11-20T14:00" } });
      fireEvent.change(document.getElementById("book-checkout") as HTMLInputElement, { target: { value: "2026-11-22T12:00" } });
      fireEvent.click(screen.getByText(thMessages.client.booking.searchButton));
    };

    it("validates the window, loads real availability and disables sold-out types", async () => {
      const spy = vi.spyOn(apiClient, "getClientAvailability").mockResolvedValue(availability);
      renderAdmin(<ClientBookingSection />);
      fireEvent.click(screen.getByText(thMessages.client.booking.searchButton));
      expect(await screen.findByText(thMessages.client.portal.booking.errorInvalidWindow)).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();
      await search();
      expect(await screen.findByText("สแตนดาร์ด")).toBeInTheDocument();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ stayMode: "Daily", slotStartAt: expect.any(String) }));
      const buttons = screen.getAllByText(thMessages.client.booking.bookNow);
      expect(buttons[1].closest("button")).toBeDisabled();
    });

    it("creates a hold through the real endpoint and opens the reservation", async () => {
      vi.spyOn(apiClient, "getClientAvailability").mockResolvedValue(availability);
      const hold = vi.spyOn(apiClient, "createClientHoldReservation").mockResolvedValue({ id: "r1" } as never);
      renderAdmin(<ClientBookingSection />);
      await search();
      await screen.findByText("สแตนดาร์ด");
      fireEvent.click(screen.getAllByText(thMessages.client.booking.bookNow)[0]);
      await waitFor(() => expect(hold).toHaveBeenCalledWith(expect.objectContaining({ unitTypeId: "ut1", stayMode: "Daily" })));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/client/reservations/r1"));
    });

    it("shows an error state with retry when availability fails", async () => {
      vi.spyOn(apiClient, "getClientAvailability").mockRejectedValue(new Error("boom"));
      renderAdmin(<ClientBookingSection />);
      await search();
      expect(await screen.findByText(thMessages.client.portal.booking.availabilityError)).toBeInTheDocument();
    });
  });
});
