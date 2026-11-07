"use client";

import * as React from "react";
import { NumberInput, type NumberInputProps } from "./number-input";

export interface CurrencyInputProps
  extends Omit<NumberInputProps, "decimals" | "step"> {
  currencyCode?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ currencyCode = "THB", min = 0, ...props }, ref) => {
    return (
      <NumberInput
        ref={ref}
        decimals={2}
        step={0.01}
        min={min}
        unitSuffix={currencyCode}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
