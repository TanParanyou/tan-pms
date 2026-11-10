"use client";

import React, { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { NOTIFICATION_TEMPLATE_I18N_KEYS } from "../constants";
import { PAGE_SIZE_OPTIONS, useServerPagination } from "@/hooks/use-server-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useClientNotifications } from "@/features/client/api/use-client-operations";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";

const CHANNELS = ["All", "InApp", "Line", "Email"] as const;
type ChannelFilter = (typeof CHANNELS)[number];

export function ClientNotificationsSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.notifications");
  const tCommon = useTranslations("common");
  const [channel, setChannel] = useState<ChannelFilter>("All");
  const pg = useServerPagination([]);
  const { data, isLoading, isError, refetch } = useClientNotifications(pg.paging);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return channel === "All" ? all : all.filter((n) => n.channel === channel);
  }, [data, channel]);
  const unread = useMemo(() => (data?.items ?? []).filter((n) => !n.isRead).length, [data]);

  return (
    <section className="space-y-4" aria-label={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-rounded text-base font-semibold text-ink">{t("title")}</h3>
            {unread > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {unread} {t("unreadBadge")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-body">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CHANNELS.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={channel === c ? "default" : "outline"}
              onClick={() => setChannel(c)}
              className="h-8 rounded-full px-3 text-xs"
            >
              {t(`channel${c}`)}
            </Button>
          ))}
        </div>
      </div>
      {isLoading && <PageLoading message={tCommon("loading")} />}
      {isError && <EmptyState title={t("loadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={t("emptyDesc")} />
      )}
      {!isLoading && !isError && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-[12px] border border-hairline bg-surface-soft/40 p-4">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-mute" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{n.templateKey in NOTIFICATION_TEMPLATE_I18N_KEYS ? t(`templates.${NOTIFICATION_TEMPLATE_I18N_KEYS[n.templateKey]}`) : resolveLocalizedText(n.title, locale)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {t(`channel${n.channel}`)}
                  </Badge>
                  {!n.isRead && <Badge variant="warning" className="text-[10px]">{t("unreadBadge")}</Badge>}
                </div>
                <p className="text-xs text-body">{resolveLocalizedText(n.body, locale)}</p>
                <span className="font-mono text-[11px] text-mute">{formatDateTime(n.createdAt, locale)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data?.pagination && data.pagination.totalCount > 0 && (
        <PaginationControls
          page={pg.page}
          pageSize={pg.pageSize}
          totalItems={data.pagination.totalCount}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={pg.setPage}
          onPageSizeChange={pg.setPageSize}
        />
      )}
    </section>
  );
}
