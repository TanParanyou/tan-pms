import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";

describe("FormTabs Component", () => {
  it("renders the red error indicator dot (data-testid='tab-error-dot-${tabId}') when a tab has validation errors", () => {
    const tabs: FormTabItem[] = [
      {
        id: "tab-guest",
        label: "Guest Information",
        hasError: true, // Has validation error!
        content: <div>Guest Form Fields</div>,
      },
      {
        id: "tab-room",
        label: "Room Assignment",
        hasError: false, // Clean
        content: <div>Room Form Fields</div>,
      },
      {
        id: "tab-payment",
        label: "Payment & Deposit",
        hasError: true, // Has validation error!
        content: <div>Payment Form Fields</div>,
      },
    ];

    render(<FormTabs tabs={tabs} defaultValue="tab-guest" />);

    // Should find error dot for tab-guest and tab-payment
    const guestErrorDot = screen.getByTestId("tab-error-dot-tab-guest");
    expect(guestErrorDot).toBeInTheDocument();
    expect(guestErrorDot).toHaveClass("bg-destructive");

    const paymentErrorDot = screen.getByTestId("tab-error-dot-tab-payment");
    expect(paymentErrorDot).toBeInTheDocument();
    expect(paymentErrorDot).toHaveClass("bg-destructive");

    // Should NOT find error dot for tab-room
    const roomErrorDot = screen.queryByTestId("tab-error-dot-tab-room");
    expect(roomErrorDot).not.toBeInTheDocument();
  });
});
