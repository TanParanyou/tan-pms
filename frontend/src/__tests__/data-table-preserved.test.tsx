import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

interface TestItem {
  id: string;
  name: string;
  status: string;
}

const testColumns: ColumnDef<TestItem>[] = [
  { id: "id", header: "ID", accessorKey: "id" },
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "status", header: "Status", accessorKey: "status" },
];

describe("Table-Preserved Architecture & ConfirmationModal", () => {
  it("preserves <thead> and headers when in isError status", () => {
    const { container } = renderWithIntl(
      <DataTable
        columns={testColumns}
        data={[]}
        isError={true}
        errorMessage="Network error"
      />
    );

    // Thead must be present
    const thead = container.querySelector("thead");
    expect(thead).toBeInTheDocument();
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();

    // Error alert must be rendered inside tbody
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Network error");
  });

  it("preserves <thead> and headers when data is empty", () => {
    const { container } = renderWithIntl(
      <DataTable
        columns={testColumns}
        data={[]}
        isLoading={false}
        emptyTitle={thMessages.common.noData}
        emptyDescription={thMessages.common.emptyFilterDescription}
      />
    );

    // Thead must be present
    const thead = container.querySelector("thead");
    expect(thead).toBeInTheDocument();
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();

    // Empty message inside tbody
    expect(screen.getByText(thMessages.common.noData)).toBeInTheDocument();
  });

  it("disables both confirm and cancel buttons when ConfirmationModal has isLoading=true", () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    renderWithIntl(
      <ConfirmationModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={thMessages.common.dialog.confirmTitle}
        message={thMessages.common.dialog.confirmCloseShiftMessage}
        confirmText={thMessages.common.confirm}
        cancelText={thMessages.common.cancel}
        isLoading={true}
      />
    );

    const buttons = screen.getAllByRole("button");
    // All buttons in modal should be disabled when loading
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });
});
