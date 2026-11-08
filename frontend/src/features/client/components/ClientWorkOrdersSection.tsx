"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTime } from "@/lib/formatters";
import {
  WORK_ORDER_STATUS_OPTIONS,
  WORK_ORDER_STATUS_BADGE_VARIANT,
  WORK_ORDER_PRIORITY_BADGE_VARIANT,
} from "@/features/work-orders/constants";
import type { WorkOrderItemDto, WorkOrderPriorityType, WorkOrderStatusType } from "@/features/work-orders/types";
import { useClientWorkOrders } from "../api/use-client-operations";

export function ClientWorkOrdersSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.workOrders");
  const tWo = useTranslations("admin.workOrders");
  const [status, setStatus] = useState("");
  const { data, isLoading, isError, refetch } = useClientWorkOrders(status || undefined);

  const columns: ColumnDef<WorkOrderItemDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (w) => <span className="font-mono text-xs">{w.documentNumber}</span> },
    { id: "summary", header: t("colSummary"), cell: (w) => <span className="text-xs text-ink">{w.issueSummary}</span> },
    {
      id: "priority",
      header: t("colPriority"),
      cell: (w) => (
        <Badge variant={WORK_ORDER_PRIORITY_BADGE_VARIANT[w.priority as WorkOrderPriorityType]}>{tWo(`priority.${w.priority}`)}</Badge>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (w) => (
        <Badge variant={WORK_ORDER_STATUS_BADGE_VARIANT[w.status as WorkOrderStatusType]}>{tWo(`status.${w.status}`)}</Badge>
      ),
    },
    { id: "created", header: t("colCreatedAt"), cell: (w) => <span className="text-xs">{formatDateTime(w.createdAt, locale)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="WKO"
        title={t("title")}
        description={t("description")}
        actions={
          <Button type="button" size="sm" onClick={() => router.push("/client/work-orders/create")} className="h-9 rounded-full px-4 gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            <span>{t("btnCreate")}</span>
          </Button>
        }
      />
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("listTitle")}</h3>
        <div className="w-48">
          <SelectPill aria-label={t("colStatus")} value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="!mb-0">
            <option value="">{t("allStatuses")}</option>
            {WORK_ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {tWo(`status.${s}`)}
              </option>
            ))}
          </SelectPill>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(w) => w.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={(w) => router.push(`/client/work-orders/${w.id}`)}
      />
    </div>
  );
}
