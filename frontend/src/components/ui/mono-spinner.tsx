"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export interface MonoSpinnerProps {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function MonoSpinner({ className = "", label, size = "md" }: MonoSpinnerProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 font-mono text-xs text-mute select-none ${className}`}
    >
      <Loader2 className={`${iconSize} animate-spin text-ink`} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export interface PageLoadingProps {
  className?: string;
  message?: string;
}

export function PageLoading({ className = "", message = "LOADING DATA..." }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`min-h-[280px] w-full flex flex-col items-center justify-center gap-3 p-8 rounded-[12px] border border-hairline bg-surface-soft/40 ${className}`}
    >
      <Loader2 className="h-6 w-6 animate-spin text-ink" />
      <span className="font-mono text-xs font-medium text-mute tracking-wider uppercase">
        {message}
      </span>
    </div>
  );
}
