"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;
let memoryToasts: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener([...memoryToasts]);
  }
}

export function dispatchToast(toast: Omit<ToastItem, "id"> & { id?: string }): string {
  const id = toast.id || Math.random().toString(36).substring(2, 9);
  const newItem: ToastItem = { ...toast, id };
  memoryToasts = [...memoryToasts, newItem];
  notifyListeners();

  const duration = toast.duration ?? 4000;
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }
  return id;
}

export function dismissToast(id: string): void {
  memoryToasts = memoryToasts.filter((t) => t.id !== id);
  notifyListeners();
}

export function clearAllToasts(): void {
  memoryToasts = [];
  notifyListeners();
}

export function getActiveToasts(): readonly ToastItem[] {
  return memoryToasts;
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isError = toast.variant === "error";
        const isSuccess = toast.variant === "success";
        const isInfo = toast.variant === "info";

        return (
          <div
            key={toast.id}
            data-testid={`toast-${toast.id}`}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-3.5 rounded-[12px] border bg-canvas text-ink shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150",
              isError ? "border-destructive/40" : "border-hairline"
            )}
          >
            {isError ? (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-ink shrink-0 mt-0.5" aria-hidden="true" />
            ) : isInfo ? (
              <Info className="h-4 w-4 text-mute shrink-0 mt-0.5" aria-hidden="true" />
            ) : null}

            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <p className="text-xs font-semibold text-ink leading-tight mb-0.5">
                  {toast.title}
                </p>
              )}
              <p className="text-xs text-body leading-relaxed">{toast.message}</p>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="text-mute hover:text-ink p-0.5 rounded-full transition-colors ml-auto shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>(memoryToasts);

  React.useEffect(() => {
    const handleUpdate = (next: ToastItem[]) => {
      setToasts(next);
    };
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return (
    <>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
