import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminWorkspaceProvider } from "@/components/shared/admin-workspace-provider";
import { LocaleProvider } from "@/components/shared/locale-provider";
import { AdminNavbar } from "@/components/layout/admin-navbar";
import { AdminSidebar, type AdminModuleKey } from "@/components/layout/admin-sidebar";
import { AdminBottomBar } from "@/components/layout/admin-bottom-bar";
import { AdminMobileDrawer } from "@/components/layout/admin-mobile-drawer";
import { redirect } from "next/navigation";
import AdminPage from "@/app/(admin)/admin/page";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: vi.fn(),
}));
import thMessages from "@/messages/th.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AdminWorkspaceProvider>
          <LocaleProvider>{ui}</LocaleProvider>
        </AdminWorkspaceProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

const SAMPLE_PROPERTIES = [
  { code: "RCD-01", name: { th: "รัชดาภิเษก", en: "Ratchada" } },
  { code: "SKV-02", name: { th: "สุขุมวิท", en: "Sukhumvit" } },
];

describe("Admin Responsive Enterprise Shell Navigation", () => {
  it("renders AdminNavbar with property pill, breadcrumb, search, notifications, and language toggle", () => {
    const onSelectProperty = vi.fn();
    const onOpenMobileDrawer = vi.fn();

    renderWithIntl(
      <AdminNavbar
        selectedProperty="RCD-01"
        onSelectProperty={onSelectProperty}
        properties={SAMPLE_PROPERTIES}
        activeModuleName="ผังห้องพักรวม"
        onOpenMobileDrawer={onOpenMobileDrawer}
      />
    );

    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText("ผังห้องพักรวม")).toBeInTheDocument();
    expect(screen.getByText("TH")).toBeInTheDocument();

    // Trigger language dropdown and switch to English
    const langBtn = screen.getByLabelText(thMessages.common.language);
    fireEvent.keyDown(langBtn, { key: "Enter" });
    expect(screen.getByText(thMessages.common.th)).toBeInTheDocument();
    expect(screen.getByText(thMessages.common.en)).toBeInTheDocument();

    fireEvent.click(screen.getByText(thMessages.common.en));
    expect(screen.getByText("EN")).toBeInTheDocument();

    // Switch back to Thai
    fireEvent.keyDown(langBtn, { key: "Enter" });
    fireEvent.click(screen.getByText("Thai"));
    expect(screen.getByText("TH")).toBeInTheDocument();

    // Trigger mobile drawer
    const drawerBtn = screen.getByLabelText(thMessages.admin.shell.moreMenu);
    fireEvent.click(drawerBtn);
    expect(onOpenMobileDrawer).toHaveBeenCalledTimes(1);
  });

  it("renders AdminSidebar with categorized modules and supports collapse toggle", () => {
    const onSelectModule = vi.fn();
    const onToggleCollapse = vi.fn();

    const { rerender } = renderWithIntl(
      <AdminSidebar
        activeModule="rack"
        onSelectModule={onSelectModule}
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
      />
    );

    // Group headings
    expect(screen.getByText(thMessages.admin.shell.groupOperations)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.shell.groupMasterData)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.shell.groupFinance)).toBeInTheDocument();

    // Module items
    expect(screen.getByText(thMessages.admin.nav.rack)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.nav.stays)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.nav.reservations)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.nav.meters)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.nav.properties)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.nav.rates)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.nav.rbac)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.nav.cashier)).toBeInTheDocument();

    // Click module
    fireEvent.click(screen.getByText(thMessages.admin.nav.meters));
    expect(onSelectModule).toHaveBeenCalledWith("meters");

    // Click collapse
    fireEvent.click(screen.getByText(thMessages.admin.shell.collapse));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);

    // Collapsed mode: labels hidden from view, accessible via sr-only
    rerender(
      <NextIntlClientProvider locale="th" messages={thMessages}>
        <LocaleProvider>
          <AdminSidebar
            activeModule="rack"
            onSelectModule={onSelectModule}
            isCollapsed={true}
            onToggleCollapse={onToggleCollapse}
          />
        </LocaleProvider>
      </NextIntlClientProvider>
    );

    expect(screen.queryByText(thMessages.admin.shell.groupOperations)).not.toBeInTheDocument();
  });

  it("renders AdminBottomBar with operational desktop status and mobile 5-tab navigation", () => {
    const onSelectModule = vi.fn();
    const onOpenMobileDrawer = vi.fn();

    renderWithIntl(
      <AdminBottomBar
        activeModule="rack"
        onSelectModule={onSelectModule}
        onOpenMobileDrawer={onOpenMobileDrawer}
        selectedProperty="RCD-01"
      />
    );

    // Desktop status bar
    expect(screen.getByLabelText("Desktop Operational Status Bar")).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.shell.liveSync)).toBeInTheDocument();

    // Mobile nav bar with 5 accessible touch targets
    const mobileNav = screen.getByLabelText("Mobile Navigation Bar");
    expect(mobileNav).toBeInTheDocument();

    const mobileButtons = mobileNav.querySelectorAll("button");
    expect(mobileButtons.length).toBe(5);

    // Click mobile more menu
    fireEvent.click(mobileButtons[4]);
    expect(onOpenMobileDrawer).toHaveBeenCalledTimes(1);
  });

  it("renders AdminMobileDrawer and allows switching to background modules", () => {
    const onSelectModule = vi.fn();
    const onClose = vi.fn();

    renderWithIntl(
      <AdminMobileDrawer
        isOpen={true}
        onClose={onClose}
        activeModule="rack"
        onSelectModule={onSelectModule}
      />
    );

    expect(screen.getByText(thMessages.admin.nav.properties)).toBeInTheDocument();
    fireEvent.click(screen.getByText(thMessages.admin.nav.properties));

    expect(onSelectModule).toHaveBeenCalledWith("properties");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("redirects the admin index to the room rack instead of rendering sample modules", () => {
    AdminPage();
    expect(redirect).toHaveBeenCalledWith("/admin/rack");
  });
});
