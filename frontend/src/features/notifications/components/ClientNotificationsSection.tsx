"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandTag } from "@/components/ui/command-tag";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { INITIAL_CLIENT_NOTIFICATIONS } from "../constants";
import type { NotificationItemDto } from "../types";

export interface ClientNotificationsSectionProps {
  initialNotifications?: NotificationItemDto[];
}

export function ClientNotificationsSection({
  initialNotifications = INITIAL_CLIENT_NOTIFICATIONS,
}: ClientNotificationsSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tNotif = useTranslations("client.notifications");
  const tCommon = useTranslations("common");

  const [notifications, setNotifications] = useState<NotificationItemDto[]>(
    initialNotifications
  );
  const [selectedChannel, setSelectedChannel] = useState<string>("All");

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (selectedChannel === "All") return notifications;
    return notifications.filter((n) => n.channel === selectedChannel);
  }, [notifications, selectedChannel]);

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <section className="space-y-4" aria-label="Customer Notification Center">
      <Card className="rounded-[12px] border border-hairline bg-canvas p-6 space-y-4 shadow-none">
        <CardHeader className="p-0 pb-3 border-b border-hairline flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CommandTag>NOTIFICATION CENTER</CommandTag>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] animate-pulse">
                  {unreadCount} {tNotif("unreadBadge")}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg font-rounded text-ink">
              {tNotif("title")}
            </CardTitle>
            <p className="text-xs text-body">{tNotif("description")}</p>
          </div>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="rounded-full text-xs h-8 px-3"
            >
              {tNotif("markAllRead")}
            </Button>
          )}
        </CardHeader>

        {/* Channel Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {["All", "InApp", "Line", "Email"].map((ch) => {
            const isSelected = selectedChannel === ch;
            const labelKey =
              ch === "All"
                ? "channelAll"
                : ch === "InApp"
                ? "channelInApp"
                : ch === "Line"
                ? "channelLine"
                : "channelEmail";
            return (
              <Button
                key={ch}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedChannel(ch)}
                className="rounded-full text-xs h-8 px-3"
              >
                {tNotif(labelKey as "channelAll" | "channelInApp" | "channelLine" | "channelEmail")}
              </Button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-hairline rounded-lg border border-hairline overflow-hidden">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-body space-y-1 bg-surface-soft">
              <span className="text-xl" aria-hidden="true">🔔</span>
              <p className="text-xs font-medium text-ink">{tNotif("emptyTitle")}</p>
              <p className="text-[11px] text-body">{tNotif("emptyDesc")}</p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const channelVariant =
                item.channel === "InApp"
                  ? "default"
                  : item.channel === "Line"
                  ? "success"
                  : "secondary";

              return (
                <div
                  key={item.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-colors ${
                    !item.isRead ? "bg-surface-soft" : "bg-canvas"
                  }`}
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <Badge variant={channelVariant} className="text-[10px]">
                        {item.channel}
                      </Badge>
                      {!item.isRead && (
                        <span
                          className="h-2 w-2 rounded-full bg-destructive inline-block"
                          aria-label="Unread notification indicator"
                        />
                      )}
                      <span className="text-[11px] font-mono text-mute">
                        {item.createdAt.slice(0, 10)}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-ink">
                      {resolveLocalizedText(item.title, locale)}
                    </h4>
                    <p className="text-xs text-body leading-relaxed">
                      {resolveLocalizedText(item.body, locale)}
                    </p>
                  </div>

                  {!item.isRead && (
                    <div className="self-end sm:self-center shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(item.id)}
                        className="rounded-full h-7 px-3 text-[11px]"
                      >
                        {tNotif("markAsRead")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </section>
  );
}
