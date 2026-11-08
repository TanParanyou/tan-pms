"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";
import { useAdminWorkOrders } from "../api/use-work-orders";
import {
  PERMISSION_WORK_ORDERS_MANAGE,
  WORK_ORDER_STATUS_OPTIONS,
  WORK_ORDER_STATUS_BADGE_VARIANT,
  WORK_ORDER_PRIORITY_BADGE_VARIANT,
} from "../constants";
import type { WorkOrderItemDto, WorkOrderPriorityType, WorkOrderStatusType } from "../types";

export function WorkOrdersListSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.workOrders");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSION_WORK_ORDERS_MANAGE);
  const [status, setStatus] = useState<WorkOrderStatusType | "">("");

  const { data, isLoading, isError, refetch } = useAdminWorkOrders(activeProperty.id, status || undefined);
  const items = useMemo(() => data?.items ?? [], [data]);

  const columns: ColumnDef<WorkOrderItemDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (w) => <span className="font-mono text-xs">{w.documentNumber}</span> },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (w) => (
        <span className="text-xs">
          {w.unit.unitNumber} ({resolveLocalizedText(w.unit.buildingName, locale)})
        </span>
      ),
    },
    { id: "summary", header: t("colSummary"), cell: (w) => <span className="text-xs text-ink">{w.issueSummary}</span> },
    {
      id: "priority",
      header: t("colPriority"),
      cell: (w) => (
        <Badge variant={WORK_ORDER_PRIORITY_BADGE_VARIANT[w.priority as WorkOrderPriorityType]}>
          {t(`priority.${w.priority}`)}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (w) => (
        <Badge variant={WORK_ORDER_STATUS_BADGE_VARIANT[w.status as WorkOrderStatusType]}>{t(`status.${w.status}`)}</Badge>
      ),
    },
    {
      id: "technician",
      header: t("colTechnician"),
      cell: (w) =>
        w.assignedTechnician?.fullName ? (
          <span className="text-xs">{w.assignedTechnician.fullName}</span>
        ) : (
          <span className="text-mute">-</span>
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
          canManage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/admin/work-orders/create")}
              className="h-9 rounded-full px-4 gap-1.5 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>{t("btnCreate")}</span>
            </Button>
          ) : undefined
        }
      />
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("listTitle")}</h3>
        <div className="w-48">
          <SelectPill
            aria-label={t("colStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as WorkOrderStatusType | "")}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allStatuses")}</option>
            {WORK_ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </SelectPill>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(w) => w.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={(w) => router.push(`/admin/work-orders/${w.id}`)}
      />
    </div>
  );
}
