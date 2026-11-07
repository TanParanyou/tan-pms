"use client";

import React from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandTag } from "@/components/ui/command-tag";
import { useTranslations } from "next-intl";
import { SAMPLE_LEASE_DETAILS, SAMPLE_INVOICE_DETAILS } from "../constants";

export function ActiveLeaseAndBillingSection() {
  const tLease = useTranslations("client.leaseCard");
  const tInvoice = useTranslations("client.invoiceSection");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      {/* 1. Active Monthly Lease Card (PM-06) */}
      <section aria-label="Monthly Lease Details">
        <Card className="rounded-[12px] border border-hairline p-6 space-y-4 shadow-none">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CommandTag prefixCode="LSE">{SAMPLE_LEASE_DETAILS.leaseNumber}</CommandTag>
                <Badge variant="success">{tLease("statusActive")}</Badge>
              </div>
              <CardTitle className="text-lg font-rounded">
                {tLease("title")}
              </CardTitle>
            </div>
            <span className="text-sm font-mono font-semibold text-ink">
              {tLease("unitLocation")}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-body block">{tLease("rentAmount")}</span>
              <span className="font-mono text-base font-semibold text-ink tabular-nums">
                {tCommon("currencySymbol")}{SAMPLE_LEASE_DETAILS.formattedRent} {tLease("monthlyUnit")}
              </span>
            </div>
            <div>
              <span className="text-body block">{tLease("depositBalance")}</span>
              <span className="font-mono text-base font-semibold text-ink tabular-nums">
                {tCommon("currencySymbol")}{SAMPLE_LEASE_DETAILS.formattedDeposit}
              </span>
            </div>
            <div>
              <span className="text-body block">{tLease("cycleLabel")}</span>
              <span className="font-mono text-sm text-ink">
                {tLease("cycleDates")}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* 2. Invoices with Line-Level Thai Tax Breakdown */}
      <section aria-label="Monthly Invoice & Tax Breakdown">
        <Card className="rounded-[12px] border border-hairline p-6 space-y-4 shadow-none">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div>
              <div className="flex items-center gap-2">
                <CommandTag prefixCode="INV">{SAMPLE_INVOICE_DETAILS.invoiceNumber}</CommandTag>
                <Badge variant="destructive">{tInvoice("statusUnpaid")}</Badge>
              </div>
              <CardTitle className="text-lg font-rounded pt-1">
                {tInvoice("title")}
              </CardTitle>
            </div>
            <div className="text-right">
              <span className="text-xs text-body block">{tInvoice("amount")}</span>
              <span className="font-mono text-xl font-bold text-ink tabular-nums">
                {tCommon("currencySymbol")}{SAMPLE_INVOICE_DETAILS.formattedTotal}
              </span>
            </div>
          </div>

          {/* Line-Level Thai Tax Classification */}
          <div className="rounded-[8px] border border-hairline overflow-hidden text-xs">
            <div className="bg-surface-soft border-b border-hairline px-4 py-2 font-medium text-body flex justify-between">
              <span>{tInvoice("descHeader")}</span>
              <span>{tInvoice("taxModeHeader")}</span>
            </div>
            <div className="divide-y divide-hairline">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-medium text-ink block">
                    {tInvoice("lineRentTitle")}
                  </span>
                  <span className="text-[11px] text-body">
                    {tInvoice("lineRentDesc")}
                  </span>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] mr-2">
                    {tInvoice("exempt")}
                  </Badge>
                  <span className="font-mono font-medium tabular-nums">
                    {tCommon("currencySymbol")}{SAMPLE_INVOICE_DETAILS.formattedRentAmount}
                  </span>
                </div>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-medium text-ink block">
                    {tInvoice("lineServiceTitle")}
                  </span>
                  <span className="text-[11px] text-body">
                    {tInvoice("lineServiceDesc")}
                  </span>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-[10px] mr-2">
                    {tInvoice("vatIncluded")}
                  </Badge>
                  <span className="font-mono font-medium tabular-nums">
                    {tCommon("currencySymbol")}{SAMPLE_INVOICE_DETAILS.formattedServiceAmount}
                  </span>
                </div>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-medium text-ink block">
                    {tInvoice("lineUtilityTitle")}
                  </span>
                  <span className="text-[11px] text-body">
                    {tInvoice("lineUtilityDesc")}
                  </span>
                </div>
                <div className="text-right">
                  <Badge variant="mono" className="text-[10px] mr-2">
                    {tInvoice("vatExcluded")}
                  </Badge>
                  <span className="font-mono font-medium tabular-nums">
                    {tCommon("currencySymbol")}{SAMPLE_INVOICE_DETAILS.formattedUtilityAmount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" className="rounded-full shadow-none text-xs">
              {tInvoice("payNow")} →
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
