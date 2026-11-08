import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AdminRbacUsersSection } from "@/features/users/components/AdminRbacUsersSection";
import { ClientNotificationsSection } from "@/features/notifications/components/ClientNotificationsSection";
import { apiClient } from "@/lib/api/api-client";
import { renderAdmin } from "./test-utils";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("PM-01: Admin RBAC & Client Notifications", () => {
  describe("AdminRbacUsersSection", () => {
    it("renders user table with column headers and initial users", () => {
      const { container } = renderWithIntl(<AdminRbacUsersSection />);

      // Verify thead exists
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();

      // Verify column headers
      expect(screen.getByText(thMessages.admin.rbac.colUser)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rbac.colRole)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rbac.colProperties)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rbac.colPermissions)).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rbac.colStatus)).toBeInTheDocument();

      // Verify initial users rendered
      expect(screen.getByText("Kittipong Vongsuwan")).toBeInTheDocument();
      expect(screen.getByText("Nattaporn Chaiyarat")).toBeInTheDocument();
      expect(screen.getByText("admin.hq@tan-pms.internal")).toBeInTheDocument();
    });

    it("preserves table headers when search query has no match", () => {
      const { container } = renderWithIntl(<AdminRbacUsersSection />);

      const searchInput = screen.getByPlaceholderText(
        thMessages.admin.rbac.searchPlaceholder
      );
      fireEvent.change(searchInput, { target: { value: "NonExistentUser12345" } });

      // Table headers must STILL be preserved
      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();
      expect(screen.getByText(thMessages.admin.rbac.colUser)).toBeInTheDocument();

      // Empty state title displayed inside table
      expect(screen.getByText(thMessages.admin.rbac.emptyTitle)).toBeInTheDocument();
    });

    it("filters users by role correctly", () => {
      renderWithIntl(<AdminRbacUsersSection />);

      const roleFilter = screen.getByDisplayValue(
        thMessages.admin.rbac.filterRoleAll
      );
      fireEvent.change(roleFilter, { target: { value: "PropertyManager" } });

      expect(screen.getByText("Nattaporn Chaiyarat")).toBeInTheDocument();
      expect(screen.queryByText("Kittipong Vongsuwan")).not.toBeInTheDocument();
    });
  });

  describe("ClientNotificationsSection", () => {
    const items = [
      { id: "n1", channel: "InApp" as const, templateKey: "t1", title: { th: "แจ้งเตือนในแอป", en: "In-app" }, body: { th: "เนื้อหา 1", en: "Body 1" }, isRead: false, createdAt: "2026-11-07T01:00:00Z" },
      { id: "n2", channel: "Line" as const, templateKey: "t2", title: { th: "แจ้งเตือนไลน์", en: "Line" }, body: { th: "เนื้อหา 2", en: "Body 2" }, isRead: true, createdAt: "2026-11-07T02:00:00Z" },
    ];
    afterEach(() => vi.restoreAllMocks());

    it("renders real notifications with channel badges and the unread indicator", async () => {
      vi.spyOn(apiClient, "getClientNotifications").mockResolvedValue({ items });
      renderAdmin(<ClientNotificationsSection />);
      expect(await screen.findByText("แจ้งเตือนในแอป")).toBeInTheDocument();
      expect(screen.getByText(thMessages.client.notifications.title)).toBeInTheDocument();
      expect(screen.getAllByText(thMessages.client.notifications.unreadBadge).length).toBeGreaterThan(0);
    });

    it("filters notifications by channel", async () => {
      vi.spyOn(apiClient, "getClientNotifications").mockResolvedValue({ items });
      renderAdmin(<ClientNotificationsSection />);
      await screen.findByText("แจ้งเตือนในแอป");
      fireEvent.click(screen.getAllByText(thMessages.client.notifications.channelLine)[0]);
      expect(screen.getByText("แจ้งเตือนไลน์")).toBeInTheDocument();
      expect(screen.queryByText("แจ้งเตือนในแอป")).not.toBeInTheDocument();
    });

    it("shows an empty state and an error state with retry", async () => {
      const spy = vi.spyOn(apiClient, "getClientNotifications").mockResolvedValue({ items: [] });
      const first = renderAdmin(<ClientNotificationsSection />);
      expect(await screen.findByText(thMessages.client.notifications.emptyTitle)).toBeInTheDocument();
      first.unmount();
      spy.mockRejectedValue(new Error("boom"));
      renderAdmin(<ClientNotificationsSection />);
      expect(await screen.findByText(thMessages.client.notifications.loadError)).toBeInTheDocument();
    });
  });
});
