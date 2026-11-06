import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AdminRbacUsersSection } from "@/features/users/components/AdminRbacUsersSection";
import { ClientNotificationsSection } from "@/features/notifications/components/ClientNotificationsSection";
import { INITIAL_CLIENT_NOTIFICATIONS } from "@/features/notifications/constants";
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
    it("renders notification items with channel badges and unread indicator", () => {
      renderWithIntl(<ClientNotificationsSection />);

      expect(screen.getByText(thMessages.client.notifications.title)).toBeInTheDocument();
      // Channel badges in notifications list
      const inAppBadges = screen.getAllByText("InApp");
      expect(inAppBadges.length).toBeGreaterThan(0);
      const lineBadges = screen.getAllByText("Line");
      expect(lineBadges.length).toBeGreaterThan(0);
      const emailBadges = screen.getAllByText("Email");
      expect(emailBadges.length).toBeGreaterThan(0);
    });

    it("filters notifications by channel correctly", () => {
      renderWithIntl(<ClientNotificationsSection />);

      const lineButton = screen.getByText(thMessages.client.notifications.channelLine);
      fireEvent.click(lineButton);

      // Line notification title should be visible
      expect(screen.getByText(INITIAL_CLIENT_NOTIFICATIONS[1].title.th)).toBeInTheDocument();
      // InApp and Email titles should NOT be in the document
      expect(screen.queryByText(INITIAL_CLIENT_NOTIFICATIONS[0].title.th)).not.toBeInTheDocument();
      expect(screen.queryByText(INITIAL_CLIENT_NOTIFICATIONS[2].title.th)).not.toBeInTheDocument();
    });

    it("marks an unread notification as read when clicking mark read button", () => {
      renderWithIntl(<ClientNotificationsSection />);

      const markReadButtons = screen.getAllByText(
        thMessages.client.notifications.markAsRead
      );
      expect(markReadButtons.length).toBeGreaterThan(0);

      fireEvent.click(markReadButtons[0]);

      // Count of mark read buttons should decrease
      const updatedButtons = screen.queryAllByText(
        thMessages.client.notifications.markAsRead
      );
      expect(updatedButtons.length).toBe(markReadButtons.length - 1);
    });

    it("marks all notifications as read when clicking mark all read button", () => {
      renderWithIntl(<ClientNotificationsSection />);

      const markAllButton = screen.getByText(
        thMessages.client.notifications.markAllRead
      );
      fireEvent.click(markAllButton);

      // No unread markAsRead buttons should remain
      const remainingButtons = screen.queryAllByText(
        thMessages.client.notifications.markAsRead
      );
      expect(remainingButtons.length).toBe(0);
    });
  });
});
