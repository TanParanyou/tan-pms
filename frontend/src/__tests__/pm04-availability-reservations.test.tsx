import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
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
