"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SelectPill } from "@/components/ui/select-pill";
import { FormField } from "./form-field";

export const PAYMENT_METHOD_OPTIONS = ["Cash", "BankTransfer", "PromptPay"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_OPTIONS)[number];

export interface PaymentMethodSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: PaymentMethodType) => void;
  disabled?: boolean;
  helperText?: string;
}

/** Cash / BankTransfer / PromptPay select reused by lease deposit, cancel refund and move-out refund. */
export function PaymentMethodSelect({ id, label, value, onChange, disabled, helperText }: PaymentMethodSelectProps) {
  const t = useTranslations("admin.stays");
  return (
    <FormField id={id} label={label} helperText={helperText}>
      <SelectPill id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as PaymentMethodType)} wrapperClassName="!mb-0">
        {PAYMENT_METHOD_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {t(`method${m}`)}
          </option>
        ))}
      </SelectPill>
    </FormField>
  );
}
