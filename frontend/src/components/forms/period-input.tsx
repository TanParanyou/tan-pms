"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Current billing period as YYYY-MM in the Asia/Bangkok calendar. */
export function getCurrentPeriod(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" })
    .formatToParts(now);
  const year = parts.filter((p) => p.type === "year").map((p) => p.value).join("");
  const month = parts.filter((p) => p.type === "month").map((p) => p.value).join("");
  return `${year}-${month}`;
}

export interface PeriodInputProps {
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  wrapperClassName?: string;
  "aria-label"?: string;
}

export function PeriodInput({ value, onValueChange, ...props }: PeriodInputProps) {
  return (
    <Input
      type="month"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="h-10 rounded-full font-mono text-xs"
      {...props}
    />
  );
}
