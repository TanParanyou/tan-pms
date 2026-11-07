/**
 * Global single-source-of-truth formatters for currency, decimals, dates, and live countdowns.
 * Enforces zero arbitrary inline formatting across all features.
 */

export function formatCurrencyThb(amount: number, options: { showFraction?: boolean } = {}): string {
  const showFraction = options.showFraction ?? false;
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: showFraction ? 2 : 0,
    maximumFractionDigits: showFraction ? 2 : 2,
  });
  return `${formatted} THB`;
}

export function formatDecimal(value: number, fractionDigits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDateTime(
  iso: string | null | undefined,
  locale: "th" | "en" = "th"
): string {
  if (!iso) return "--:--";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export function formatCountdownMmSs(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
