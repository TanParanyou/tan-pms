import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { UnitMasterSection } from "@/features/properties/components/UnitMasterSection";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("PM-02: Property & Unit Master UI", () => {
  it("renders units table with column headers, summary badges, and units", () => {
    const { container } = renderWithIntl(<UnitMasterSection />);

    // Verify thead exists
    const thead = container.querySelector("thead");
    expect(thead).toBeInTheDocument();

    // Verify column headers
    expect(screen.getByText(thMessages.admin.properties.colUnit)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.properties.colUnitType)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.properties.colStayModes)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.properties.colStatus)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.properties.colAssets)).toBeInTheDocument();

    // Verify units rendered
    expect(screen.getByText("A-101")).toBeInTheDocument();
    expect(screen.getByText("A-201")).toBeInTheDocument();
    expect(screen.getByText("A-301")).toBeInTheDocument();

    // Verify asset tags rendered
    const assetTags = screen.getAllByText("AST-00001");
    expect(assetTags.length).toBeGreaterThan(0);
  });

  it("preserves table headers when search query has no match", () => {
    const { container } = renderWithIntl(<UnitMasterSection />);

    const searchInput = screen.getByPlaceholderText(
      thMessages.admin.properties.searchPlaceholder
    );
    fireEvent.change(searchInput, { target: { value: "NON-EXISTENT-ROOM-999" } });

    // Table thead must STILL be present
    const thead = container.querySelector("thead");
    expect(thead).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.properties.colUnit)).toBeInTheDocument();

    // Empty state title displayed inside tbody
    expect(screen.getByText(thMessages.admin.properties.emptyTitle)).toBeInTheDocument();
  });

  it("filters units by building correctly", () => {
    renderWithIntl(<UnitMasterSection />);

    const buildingFilter = screen.getByDisplayValue(
      thMessages.admin.properties.filterBuildingAll
    );
    fireEvent.change(buildingFilter, { target: { value: "BLD-A" } });

    expect(screen.getByText("A-101")).toBeInTheDocument();
  });

  it("opens unit configuration dialog and shows unit number input", () => {
    renderWithIntl(<UnitMasterSection />);

    const configButtons = screen.getAllByText(
      thMessages.admin.properties.configureUnit
    );
    expect(configButtons.length).toBeGreaterThan(0);

    fireEvent.click(configButtons[0]);

    // Modal title should appear
    expect(screen.getByText(thMessages.admin.properties.modalTitleEdit)).toBeInTheDocument();
    // Unit Number input should have value A-101
    expect(screen.getByDisplayValue("A-101")).toBeInTheDocument();
  });
});
