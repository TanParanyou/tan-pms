import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
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

describe("PM-01: Client Notifications", () => {
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
