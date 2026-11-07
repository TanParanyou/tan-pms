"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "./form-field";

export interface LocalizedTextFieldsProps {
  idPrefix?: string;
  labelTh: string;
  labelEn: string;
  valueTh: string;
  valueEn: string;
  onChangeTh: (val: string) => void;
  onChangeEn: (val: string) => void;
  placeholderTh: string;
  placeholderEn: string;
  errorTh?: string;
  errorEn?: string;
  required?: boolean;
  className?: string;
}

export function LocalizedTextFields({
  idPrefix = "localized-input",
  labelTh,
  labelEn,
  valueTh,
  valueEn,
  onChangeTh,
  onChangeEn,
  placeholderTh,
  placeholderEn,
  errorTh,
  errorEn,
  required = true,
  className = "",
}: LocalizedTextFieldsProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      <FormField
        id={`${idPrefix}-th`}
        label={labelTh}
        required={required}
        error={errorTh}
      >
        <Input
          id={`${idPrefix}-th`}
          value={valueTh}
          onChange={(e) => onChangeTh(e.target.value)}
          placeholder={placeholderTh}
          className="h-10 rounded-full text-xs"
        />
      </FormField>

      <FormField
        id={`${idPrefix}-en`}
        label={labelEn}
        error={errorEn}
      >
        <Input
          id={`${idPrefix}-en`}
          value={valueEn}
          onChange={(e) => onChangeEn(e.target.value)}
          placeholder={placeholderEn}
          className="h-10 rounded-full text-xs"
        />
      </FormField>
    </div>
  );
}
