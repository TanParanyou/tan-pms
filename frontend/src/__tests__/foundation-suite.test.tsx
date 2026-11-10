import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, renderHook } from "@testing-library/react";
import React from "react";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";

// Controls
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { NumberInput } from "@/components/forms/number-input";
import { CurrencyInput } from "@/components/forms/currency-input";
import { DateTimeInput } from "@/components/ui/date-picker";
import { DataTable, type ColumnDef, type DataTableSortState } from "@/components/ui/data-table";
import { BulkActionToolbar } from "@/components/layout/bulk-action-toolbar";
import { ToastProvider, clearAllToasts } from "@/components/ui/toast";

// Hooks & Libs
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDataTableState } from "@/hooks/use-data-table-state";
import { usePermission, PermissionProvider } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/api-error";
import {
  isValidThaiNationalId,
  moneyAmountSchema,
  localizedTextSchema,
  thaiNationalIdSchema,
  positiveMoneySchema,
} from "@/lib/validators";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

interface TestRow {
  id: string;
  name: string;
  category: string;
  amount: number;
}

const testColumns: ColumnDef<TestRow>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sortable: true,
  },
  {
    id: "category",
    header: "Category",
    accessorKey: "category",
  },
  {
    id: "amount",
    header: "Amount",
    accessorKey: "amount",
    sortable: true,
    sortValue: (row) => row.amount,
    align: "right",
  },
];

const mockRows: TestRow[] = [
  { id: "row-1", name: "Alpha", category: "Standard", amount: 150 },
  { id: "row-2", name: "Beta", category: "Deluxe", amount: 250 },
  { id: "row-3", name: "Gamma", category: "Suite", amount: 350 },
  { id: "row-4", name: "Delta", category: "Standard", amount: 100 },
];

describe("Enterprise Foundation Suite", () => {
  beforeEach(() => {
    clearAllToasts();
    vi.clearAllMocks();
  });

  describe("1. DataTable Enterprise Standards", () => {
    it("resolves row ID using getRowId callback", () => {
      const getRowIdSpy = vi.fn((row: TestRow) => `custom-${row.id}`);
      const { container } = renderWithIntl(
        <DataTable
          columns={testColumns}
          data={mockRows}
          getRowId={getRowIdSpy}
          enableRowSelection
        />
      );

      expect(getRowIdSpy).toHaveBeenCalled();
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(mockRows.length);
    });

    it("handles column sorting correctly (toggles asc -> desc -> none)", () => {
      const { container } = renderWithIntl(
        <DataTable columns={testColumns} data={mockRows} />
      );

      const nameSortBtn = screen.getByRole("button", { name: "Name" });

      // Initial click -> asc
      fireEvent.click(nameSortBtn);
      let cells = container.querySelectorAll("tbody tr td:first-child");
      expect(cells[0].textContent).toBe("Alpha");
      expect(cells[3].textContent).toBe("Gamma");

      // Second click -> desc
      fireEvent.click(nameSortBtn);
      cells = container.querySelectorAll("tbody tr td:first-child");
      expect(cells[0].textContent).toBe("Gamma");
      expect(cells[3].textContent).toBe("Alpha");

      // Third click -> none (returns to default order)
      fireEvent.click(nameSortBtn);
      cells = container.querySelectorAll("tbody tr td:first-child");
      expect(cells[0].textContent).toBe("Alpha");
      expect(cells[1].textContent).toBe("Beta");
    });

    it("supports controlled sortState and calls onSortChange callback", () => {
      const handleSortChange = vi.fn();
      const sortState: DataTableSortState = { columnId: "amount", direction: "desc" };

      renderWithIntl(
        <DataTable
          columns={testColumns}
          data={mockRows}
          sortState={sortState}
          onSortChange={handleSortChange}
        />
      );

      const amountSortBtn = screen.getByRole("button", { name: "Amount" });
      fireEvent.click(amountSortBtn);

      expect(handleSortChange).toHaveBeenCalledWith(null);
    });

    it("manages row selection, Select All checkbox, and BulkActionToolbar", () => {
      const handleSelectionChange = vi.fn();

      const TestComponent = () => {
        const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
        return (
          <>
            <DataTable
              columns={testColumns}
              data={mockRows}
              enableRowSelection
              selectedRowIds={selectedIds}
              onSelectionChange={(ids) => {
                setSelectedIds(ids);
                handleSelectionChange(ids);
              }}
            />
            <BulkActionToolbar
              selectedCount={selectedIds.length}
              onClearSelection={() => {
                setSelectedIds([]);
                handleSelectionChange([]);
              }}
              actions={<span data-testid="bulk-action">Action</span>}
            />
          </>
        );
      };

      renderWithIntl(<TestComponent />);

      // Initially no toolbar
      expect(screen.queryByTestId("bulk-action")).not.toBeInTheDocument();

      // Click Select All
      const selectAllCheckbox = screen.getByRole("checkbox", {
        name: thMessages.common.table.selectAll,
      });
      fireEvent.click(selectAllCheckbox);

      expect(handleSelectionChange).toHaveBeenCalledWith(["row-1", "row-2", "row-3", "row-4"]);
      expect(screen.getByTestId("bulk-action")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();

      // Click row checkbox to deselect one
      const rowCheckboxes = screen.getAllByRole("checkbox", {
        name: thMessages.common.table.selectRow,
      });
      fireEvent.click(rowCheckboxes[0]);

      expect(screen.getByText("3")).toBeInTheDocument();

      // Click clear button on toolbar
      const clearBtn = screen.getByRole("button", { name: thMessages.common.clear });
      fireEvent.click(clearBtn);

      expect(screen.queryByTestId("bulk-action")).not.toBeInTheDocument();
    });

    it("performs client-side pagination with page size and Next/Prev controls", () => {
      const manyRows: TestRow[] = Array.from({ length: 25 }, (_, i) => ({
        id: `row-${i + 1}`,
        name: `Item ${i + 1}`,
        category: "Test",
        amount: (i + 1) * 10,
      }));

      renderWithIntl(
        <DataTable
          columns={testColumns}
          data={manyRows}
          enablePagination
          pageSize={10}
        />
      );

      // Page 1 should show Item 1 to 10
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 10")).toBeInTheDocument();
      expect(screen.queryByText("Item 11")).not.toBeInTheDocument();
      expect(screen.getByText("1 / 3")).toBeInTheDocument();

      // Next button
      const nextBtn = screen.getByRole("button", {
        name: thMessages.common.table.next,
      });
      fireEvent.click(nextBtn);

      // Page 2 should show Item 11 to 20
      expect(screen.getByText("Item 11")).toBeInTheDocument();
      expect(screen.getByText("Item 20")).toBeInTheDocument();
      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("renders EmptyState when isZeroEntities is true without preserving table headers", () => {
      const { container } = renderWithIntl(
        <DataTable
          columns={testColumns}
          data={[]}
          isZeroEntities={true}
          zeroEntitiesTitle="No properties found"
          zeroEntitiesDescription="Create your first property to get started."
        />
      );

      expect(container.querySelector("table")).toBeNull();
      expect(screen.getByText("No properties found")).toBeInTheDocument();
      expect(
        screen.getByText("Create your first property to get started.")
      ).toBeInTheDocument();
    });

    it("preserves <thead> when filtered data is empty without isZeroEntities", () => {
      const { container } = renderWithIntl(
        <DataTable
          columns={testColumns}
          data={[]}
          isZeroEntities={false}
          emptyTitle="No results match filter"
        />
      );

      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container.querySelector("thead")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("No results match filter")).toBeInTheDocument();
    });

    it("renders MonoSpinner loading state inside TableBody while keeping thead intact", () => {
      const { container } = renderWithIntl(
        <DataTable columns={testColumns} data={[]} isLoading={true} />
      );

      expect(container.querySelector("thead")).toBeInTheDocument();
      expect(screen.getByText(thMessages.common.loading)).toBeInTheDocument();
    });
  });

  describe("2. UI Form Controls & Primitives", () => {
    it("renders Textarea and applies error styling when hasError is true", () => {
      const { rerender } = render(
        <Textarea placeholder="Remarks" hasError={false} />
      );
      const textarea = screen.getByPlaceholderText("Remarks");
      expect(textarea).not.toHaveAttribute("aria-invalid");

      rerender(<Textarea placeholder="Remarks" hasError={true} />);
      expect(textarea).toHaveAttribute("aria-invalid", "true");
      expect(textarea.className).toContain("border-destructive");
    });

    it("renders Checkbox and handles checked, unchecked, and indeterminate states", () => {
      const handleCheckedChange = vi.fn();
      const { rerender } = render(
        <Checkbox
          checked={false}
          onCheckedChange={handleCheckedChange}
          aria-label="Terms"
        />
      );

      const checkbox = screen.getByRole("checkbox", { name: "Terms" });
      expect(checkbox).toHaveAttribute("aria-checked", "false");
      expect(checkbox).toHaveAttribute("data-state", "unchecked");

      fireEvent.click(checkbox);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);

      rerender(
        <Checkbox
          checked="indeterminate"
          onCheckedChange={handleCheckedChange}
          aria-label="Terms"
        />
      );
      expect(checkbox).toHaveAttribute("aria-checked", "mixed");
      expect(checkbox).toHaveAttribute("data-state", "indeterminate");
    });

    it("renders Switch and toggles on click and keyboard enter", () => {
      const handleCheckedChange = vi.fn();
      render(
        <Switch
          checked={false}
          onCheckedChange={handleCheckedChange}
          aria-label="Toggle active"
        />
      );

      const switchBtn = screen.getByRole("switch", { name: "Toggle active" });
      expect(switchBtn).toHaveAttribute("aria-checked", "false");

      fireEvent.click(switchBtn);
      expect(handleCheckedChange).toHaveBeenCalledWith(true);

      fireEvent.keyDown(switchBtn, { key: "Enter" });
      expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it("renders EntityAutocomplete with live filtering and selection (zero .find)", () => {
      const handleValueChange = vi.fn();
      const options = [
        { value: "u-101", label: "Room 101", code: "STD", sublabel: "Floor 1" },
        { value: "u-201", label: "Room 201", code: "DLX", sublabel: "Floor 2" },
      ];

      render(
        <EntityAutocomplete
          options={options}
          value=""
          onValueChange={handleValueChange}
          placeholder="Select a unit"
          searchPlaceholder="Search rooms..."
        />
      );

      const trigger = screen.getByRole("combobox");
      expect(trigger).toHaveTextContent("Select a unit");

      fireEvent.click(trigger);
      expect(screen.getByPlaceholderText("Search rooms...")).toBeInTheDocument();

      // Click option
      const opt = screen.getByText("Room 101");
      fireEvent.click(opt);

      expect(handleValueChange).toHaveBeenCalledWith("u-101");
    });

    it("renders EntityAutocomplete with adjacentAction button", () => {
      const handleActionClick = vi.fn();
      render(
        <EntityAutocomplete
          options={[]}
          value=""
          onValueChange={vi.fn()}
          placeholder="Select customer"
          adjacentAction={{
            tooltip: "Create new customer",
            ariaLabel: "Add customer",
            onClick: handleActionClick,
          }}
        />
      );

      const actionBtn = screen.getByRole("button", { name: "Add customer" });
      expect(actionBtn).toBeInTheDocument();
      fireEvent.click(actionBtn);
      expect(handleActionClick).toHaveBeenCalled();
    });

    it("renders NumberInput and CurrencyInput with 2 decimal precision and suffix", () => {
      const handleNumberChange = vi.fn();
      render(
        <NumberInput
          value={1250.5}
          onValueChange={handleNumberChange}
          decimals={2}
          unitSuffix="THB"
          placeholder="Amount"
        />
      );

      const input = screen.getByPlaceholderText("Amount") as HTMLInputElement;
      expect(input.value).toBe("1250.50");
      expect(screen.getByText("THB")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "1500" } });
      expect(handleNumberChange).toHaveBeenCalledWith(1500);
    });

    it("renders DateTimeInput in date and datetime modes", () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <DateTimeInput
          mode="date"
          value="2026-11-07"
          onValueChange={handleChange}
          placeholder="Select date"
        />
      );

      const input = screen.getByPlaceholderText("Select date") as HTMLInputElement;
      expect(input.type).toBe("date");
      expect(input.value).toBe("2026-11-07");

      rerender(
        <DateTimeInput
          mode="datetime"
          value="2026-11-07T14:30"
          onValueChange={handleChange}
          placeholder="Select datetime"
        />
      );
      expect(input.type).toBe("datetime-local");
      expect(input.value).toBe("2026-11-07T14:30");
    });
  });

  describe("3. Enterprise Hooks & Utilities", () => {
    it("debounces value changes with useDebouncedValue", () => {
      vi.useFakeTimers();

      const { result, rerender } = renderHook(
        ({ val }) => useDebouncedValue(val, 300),
        { initialProps: { val: "initial" } }
      );

      expect(result.current).toBe("initial");

      rerender({ val: "updated" });
      expect(result.current).toBe("initial");

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe("updated");
      vi.useRealTimers();
    });

    it("manages DataTable state and resets page to 1 on search or filter change", () => {
      const { result } = renderHook(() =>
        useDataTableState({
          initialPage: 3,
          initialFilters: { status: "Active" },
        })
      );

      expect(result.current.page).toBe(3);

      act(() => {
        result.current.setSearchQuery("Jane");
      });

      expect(result.current.searchQuery).toBe("Jane");
      expect(result.current.page).toBe(1);

      act(() => {
        result.current.setPage(4);
      });
      expect(result.current.page).toBe(4);

      act(() => {
        result.current.setFilter("status", "Inactive");
      });
      expect(result.current.page).toBe(1);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("evaluates RBAC permissions with usePermission defaulting to full admin", () => {
      const { result } = renderHook(() => usePermission());

      expect(result.current.roleCode).toBe("OrganizationAdmin");
      expect(result.current.hasPermission("admin.users.manage")).toBe(true);
      expect(result.current.hasAnyPermission(["unknown.action", "admin.users.manage"])).toBe(true);
      expect(result.current.hasPropertyAccess("prop-bkk01")).toBe(true);
    });

    it("evaluates custom restricted permissions inside PermissionProvider", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PermissionProvider
          roleCode="CashierStaff"
          permissions={["cashier.shifts.view"]}
          allowedPropertyIds={["prop-bkk01"]}
        >
          {children}
        </PermissionProvider>
      );

      const { result } = renderHook(() => usePermission(), { wrapper });

      expect(result.current.roleCode).toBe("CashierStaff");
      expect(result.current.hasPermission("cashier.shifts.view")).toBe(true);
      expect(result.current.hasPermission("admin.users.manage")).toBe(false);
      expect(result.current.hasPropertyAccess("prop-bkk01")).toBe(true);
      expect(result.current.hasPropertyAccess("prop-cnx01")).toBe(false);
    });

    it("registers beforeunload listener with useUnsavedChanges when dirty", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");

      const { rerender, unmount } = renderHook(
        ({ isDirty }) => useUnsavedChanges(isDirty),
        { initialProps: { isDirty: false } }
      );

      expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

      rerender({ isDirty: true });
      expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

      unmount();
      expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    });

    it("dispatches success toast and API error toast with RFC 9457 error code localization", () => {
      const TestToastView = () => {
        const { toastSuccess, toastApiError } = useToast();
        return (
          <div>
            <button
              type="button"
              onClick={() => toastSuccess("Item created successfully")}
            >
              Trigger Success
            </button>
            <button
              type="button"
              onClick={() => {
                const apiErr = new ApiError({
                  status: 400,
                  errorCode: "reservation.hold_expired",
                  message: "Hold expired",
                });
                toastApiError(apiErr);
              }}
            >
              Trigger Api Error
            </button>
          </div>
        );
      };

      render(
        <NextIntlClientProvider locale="th" messages={thMessages}>
          <ToastProvider>
            <TestToastView />
          </ToastProvider>
        </NextIntlClientProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Trigger Success" }));
      expect(screen.getByText("Item created successfully")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Trigger Api Error" }));
      // Error code reservation.hold_expired resolves to localized Thai message in thMessages
      expect(
        screen.getByText(thMessages.errors.reservation_hold_expired)
      ).toBeInTheDocument();
    });
  });

  describe("4. Query Keys & Domain Validators", () => {
    it("generates structured query keys across all domains", () => {
      expect(queryKeys.auth.session()).toEqual(["auth", "session"]);
      expect(queryKeys.users.list()).toEqual(["admin-users", "list"]);
      expect(queryKeys.users.detail("u-1")).toEqual(["admin-users", "detail", "u-1"]);
      expect(queryKeys.properties.hierarchy("prop-1")).toEqual([
        "admin-property-hierarchy",
        "prop-1",
      ]);
      expect(queryKeys.rates.catalog("prop-1")).toEqual(["admin-rates", "prop-1"]);
      expect(queryKeys.reservations.list("prop-1")).toEqual(["admin-reservations", "prop-1", "", ""]);
      expect(queryKeys.reservations.list("prop-1", "Hold", "Daily")).toEqual(["admin-reservations", "prop-1", "Hold", "Daily"]);
      expect(queryKeys.rack.byProperty("prop-1")).toEqual(["admin-rack", "prop-1"]);
      expect(queryKeys.stays.list("prop-1")).toEqual(["admin-stays", "prop-1", "", ""]);
    });

    it("validates 13-digit Thai Citizen ID Modulo-11 checksum correctly", () => {
      // Valid Modulo-11 IDs
      expect(isValidThaiNationalId("1100702581272")).toBe(true);
      expect(isValidThaiNationalId("1234567890121")).toBe(true);
      expect(thaiNationalIdSchema.safeParse("1100702581272").success).toBe(true);

      // Invalid IDs
      expect(isValidThaiNationalId("1100702581279")).toBe(false); // wrong check digit
      expect(isValidThaiNationalId("1111111111111")).toBe(false); // repeated identical
      expect(isValidThaiNationalId("0000000000000")).toBe(false); // repeated identical
      expect(isValidThaiNationalId("123")).toBe(false); // short
      expect(isValidThaiNationalId("not-numbers")).toBe(false);
      expect(thaiNationalIdSchema.safeParse("1100702581279").success).toBe(false);
    });

    it("validates moneyAmountSchema (non-negative finite with max 2 decimals)", () => {
      expect(moneyAmountSchema.safeParse(0).success).toBe(true);
      expect(moneyAmountSchema.safeParse(1250.75).success).toBe(true);
      expect(moneyAmountSchema.safeParse(500).success).toBe(true);

      // Invalid
      expect(moneyAmountSchema.safeParse(-10).success).toBe(false);
      expect(moneyAmountSchema.safeParse(10.123).success).toBe(false);
      expect(moneyAmountSchema.safeParse(Infinity).success).toBe(false);
    });

    it("validates positiveMoneySchema (strictly positive)", () => {
      expect(positiveMoneySchema.safeParse(0.01).success).toBe(true);
      expect(positiveMoneySchema.safeParse(0).success).toBe(false);
      expect(positiveMoneySchema.safeParse(-5).success).toBe(false);
    });

    it("validates localizedTextSchema requiring th and en strings", () => {
      expect(
        localizedTextSchema.safeParse({ th: "ภาษาไทย", en: "English" }).success
      ).toBe(true);
      expect(localizedTextSchema.safeParse({ th: "", en: "English" }).success).toBe(
        false
      );
      expect(localizedTextSchema.safeParse({ th: "ภาษาไทย", en: "" }).success).toBe(
        false
      );
    });
  });
});
