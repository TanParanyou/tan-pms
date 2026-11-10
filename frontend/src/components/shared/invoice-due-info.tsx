"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { daysOverdue } from "@/lib/due-date";

export interface InvoiceDueInfoProps {
  status?: string | null;
  dueDate?: string | null;
}

/** Due date plus an overdue badge; the status always comes from the backend. */
export function InvoiceDueInfo({ status, dueDate }: InvoiceDueInfoProps) {
  const t = useTranslations("common.dueDate");
  const days = daysOverdue(status, dueDate);
  const overdue = status === "Overdue";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-xs tabular-nums" data-testid="invoice-due-date">
        {dueDate ?? "-"}
      </span>
      {overdue && (
        <Badge variant="overdue" data-testid="invoice-overdue-badge">
          {days === null ? t("overdue") : t("overdueDays", { count: days })}
        </Badge>
      )}
    </div>
  );
}
