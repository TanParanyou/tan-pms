const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Default analytics window: the last `days` days up to and including today (local calendar dates). */
export function defaultAnalyticsRange(days: number, now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return { from: toDateInput(start), to: toDateInput(now) };
}

export const isValidRange = (from: string, to: string) => Boolean(from) && Boolean(to) && from <= to;
