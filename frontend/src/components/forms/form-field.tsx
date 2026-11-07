"use client";

import React from "react";
import { Label } from "@/components/ui/label";

export interface FormFieldProps {
  id?: string;
  label?: React.ReactNode;
  required?: boolean;
  topRightAction?: React.ReactNode;
  error?: string;
  helperText?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  topRightAction,
  error,
  helperText,
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || topRightAction) && (
        <div className="flex items-center justify-between min-h-[20px]">
          {label && (
            <Label htmlFor={id} className="text-xs font-medium text-ink flex items-center gap-1">
              <span>{label}</span>
              {required && <span className="text-destructive">*</span>}
            </Label>
          )}
          {topRightAction && <div>{topRightAction}</div>}
        </div>
      )}

      {children}

      {error ? (
        <p className="text-[11px] font-mono text-destructive tracking-tight animate-in fade-in duration-150">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-mute">{helperText}</p>
      ) : null}
    </div>
  );
}
