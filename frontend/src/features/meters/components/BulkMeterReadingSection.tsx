"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useTranslations } from "next-intl";
import type { MeterReadingRow } from "../types";
import { INITIAL_METER_ROWS } from "../constants";

export function BulkMeterReadingSection() {
  const tMeters = useTranslations("admin.meters");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tPlaceholders = useTranslations("common.placeholders");

  const [rows, setRows] = useState<MeterReadingRow[]>(INITIAL_METER_ROWS);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const handleReadingChange = (
    index: number,
    field: "currentWater" | "currentElectric",
    value: string
  ) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleRolloverConfirm = (index: number) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        isRolloverConfirmed: !copy[index].isRolloverConfirmed,
      };
      return copy;
    });
  };

  const handleSaveAll = () => {
    setSaveSuccessMessage(tMeters("savedSuccess"));
  };

  return (
    <section className="space-y-4" aria-label="Bulk Meter Reading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-rounded font-medium text-ink">
            {tMeters("title")}
          </h2>
          <p className="text-xs text-body">{tMeters("description")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveAll}
            className="rounded-full text-xs shadow-none"
          >
            💾 {tMeters("saveBatch")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setSaveSuccessMessage(tMeters("invoiceRunSuccess"))}
            className="rounded-full text-xs shadow-none"
          >
            ⚡ {tMeters("batchInvoice")}
          </Button>
        </div>
      </div>

      {saveSuccessMessage && (
        <Alert
          variant="success"
          onClose={() => setSaveSuccessMessage(null)}
          title={tCommon("save")}
        >
          {saveSuccessMessage}
        </Alert>
      )}

      {/* Table-Preserved Architecture & Zero Layout Shift */}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] text-xs font-medium">{tMeters("unit")}</TableHead>
            <TableHead className="w-[120px] text-xs font-medium">
              {tMeters("previous")} ({tMeters("waterLabel")})
            </TableHead>
            <TableHead className="w-[160px] text-xs font-medium">
              {tMeters("current")} ({tMeters("waterLabel")})
            </TableHead>
            <TableHead className="w-[120px] text-right text-xs font-medium">
              {tMeters("usage")} ({tMeters("waterLabel")})
            </TableHead>
            <TableHead className="w-[120px] text-xs font-medium">
              {tMeters("previous")} ({tMeters("electricLabel")})
            </TableHead>
            <TableHead className="w-[160px] text-xs font-medium">
              {tMeters("current")} ({tMeters("electricLabel")})
            </TableHead>
            <TableHead className="w-[120px] text-right text-xs font-medium">
              {tMeters("usage")} ({tMeters("electricLabel")})
            </TableHead>
            <TableHead className="w-[180px] text-xs font-medium">{tMeters("statusLabel")}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row, idx) => {
            const currentWater = parseFloat(row.currentWater) || 0;
            const isWaterRollover = currentWater < row.previousWater;
            const waterUsage = !isWaterRollover
              ? currentWater - row.previousWater
              : row.isRolloverConfirmed
              ? currentWater + 10000 - row.previousWater
              : null;

            const currentElec = parseFloat(row.currentElectric) || 0;
            const elecUsage = currentElec - row.previousElectric;

            return (
              <TableRow key={row.unitId}>
                {/* 1. Unit */}
                <TableCell className="align-middle">
                  <span className="font-mono font-semibold text-xs text-ink block">
                    {row.unitNumber}
                  </span>
                  <div className="mt-1 min-h-[16px]">
                    <span className="invisible select-none" aria-hidden="true">-</span>
                  </div>
                </TableCell>

                {/* 2. Previous Water */}
                <TableCell className="align-middle font-mono tabular-nums text-xs text-body">
                  <span>{row.previousWater.toFixed(1)}</span>
                  <div className="mt-1 min-h-[16px]">
                    <span className="text-[10px] text-mute">m³</span>
                  </div>
                </TableCell>

                {/* 3. Current Water Input with Live Calculation subtext */}
                <TableCell className="align-middle">
                  <Input
                    value={row.currentWater}
                    placeholder={tPlaceholders("waterReading")}
                    onChange={(e) =>
                      handleReadingChange(idx, "currentWater", e.target.value)
                    }
                    wrapperClassName="!mb-0"
                    className={`h-8 px-3 font-mono text-xs tabular-nums ${
                      isWaterRollover && !row.isRolloverConfirmed
                        ? "border-destructive text-destructive"
                        : ""
                    }`}
                  />
                  <div className="mt-1 min-h-[16px]">
                    {isWaterRollover && !row.isRolloverConfirmed ? (
                      <span className="text-[10px] text-destructive font-medium block">
                        {tErrors("meter_rollover_unconfirmed")}
                      </span>
                    ) : (
                      <span className="invisible select-none" aria-hidden="true">-</span>
                    )}
                  </div>
                </TableCell>

                {/* 4. Water Usage (Zero Layout Shift) */}
                <TableCell className="align-middle text-right font-mono tabular-nums text-xs font-semibold text-ink">
                  <span>
                    {waterUsage !== null ? `${waterUsage.toFixed(1)} m³` : tMeters("statusError")}
                  </span>
                  <div className="mt-1 min-h-[16px]">
                    <span className="invisible select-none" aria-hidden="true">-</span>
                  </div>
                </TableCell>

                {/* 5. Previous Electric */}
                <TableCell className="align-middle font-mono tabular-nums text-xs text-body">
                  <span>{row.previousElectric.toFixed(0)}</span>
                  <div className="mt-1 min-h-[16px]">
                    <span className="text-[10px] text-mute">kWh</span>
                  </div>
                </TableCell>

                {/* 6. Current Electric Input */}
                <TableCell className="align-middle">
                  <Input
                    value={row.currentElectric}
                    placeholder={tPlaceholders("electricReading")}
                    onChange={(e) =>
                      handleReadingChange(idx, "currentElectric", e.target.value)
                    }
                    wrapperClassName="!mb-0"
                    className="h-8 px-3 font-mono text-xs tabular-nums"
                  />
                  <div className="mt-1 min-h-[16px]">
                    <span className="invisible select-none" aria-hidden="true">-</span>
                  </div>
                </TableCell>

                {/* 7. Electric Usage (Zero Layout Shift) */}
                <TableCell className="align-middle text-right font-mono tabular-nums text-xs font-semibold text-ink">
                  <span>{`${elecUsage.toFixed(0)} kWh`}</span>
                  <div className="mt-1 min-h-[16px]">
                    <span className="invisible select-none" aria-hidden="true">-</span>
                  </div>
                </TableCell>

                {/* 8. Rollover Status & Action */}
                <TableCell className="align-middle">
                  <div className="flex items-center">
                    {isWaterRollover ? (
                      row.isRolloverConfirmed ? (
                        <Badge variant="success" className="text-[10px]">
                          ✓ {tMeters("rolloverConfirmed")}
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => toggleRolloverConfirm(idx)}
                          className="rounded-full h-7 px-3 text-[11px] animate-pulse"
                        >
                          ⚠️ {tMeters("rolloverConfirmed")}
                        </Button>
                      )
                    ) : (
                      <span className="text-[11px] text-mute">{tMeters("statusNormal")}</span>
                    )}
                  </div>
                  <div className="mt-1 min-h-[16px]">
                    <span className="invisible select-none" aria-hidden="true">-</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
