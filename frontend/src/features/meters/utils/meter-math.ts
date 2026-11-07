/**
 * Display-only usage preview. Final usage and charge always come from the save response.
 * Rollover: usage = 10^digits - previous + current (meter wrapped around its max digits).
 */
export function previewUsage(
  previous: number,
  currentInput: string,
  rolloverConfirmed: boolean,
  meterMaxDigits: number | null | undefined
): number | null {
  if (currentInput.trim() === "") return null;
  const current = Number(currentInput);
  if (!Number.isFinite(current) || current < 0) return null;
  if (current >= previous) return current - previous;
  if (!rolloverConfirmed || meterMaxDigits == null) return null;
  return 10 ** meterMaxDigits - previous + current;
}

export function isBelowPrevious(previous: number, currentInput: string): boolean {
  if (currentInput.trim() === "") return false;
  const current = Number(currentInput);
  return Number.isFinite(current) && current < previous;
}
