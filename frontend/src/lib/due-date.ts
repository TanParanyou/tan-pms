const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Days past the backend due date, shown only when the backend status is Overdue.
 * Returns null when there is nothing to display (not overdue, no due date, or the date is not in the past).
 */
export function daysOverdue(status: string | null | undefined, dueDate: string | null | undefined, now: Date = new Date()): number | null {
  if (status !== "Overdue" || !dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.floor((startOfDay(now) - startOfDay(due)) / MS_PER_DAY);
  return days > 0 ? days : null;
}
