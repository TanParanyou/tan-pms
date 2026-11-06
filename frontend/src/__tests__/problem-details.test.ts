import { describe, it, expect } from "vitest";
import {
  getLocalizedErrorMessage,
  getErrorCodeKey,
  isProblemDetails,
  parseProblemDetails,
  type ProblemDetailsResponse,
} from "@/lib/problem-details";
import thMessages from "@/messages/th.json";
import enMessages from "@/messages/en.json";

describe("RFC 9457 Problem Details Error Mapper", () => {
  it("should validate and parse RFC 9457 Problem Details objects", () => {
    const rawProblem: ProblemDetailsResponse = {
      type: "https://tan-pms.internal/errors/unit.not_clean",
      title: "Unit condition is not clean for check-in",
      status: 409,
      detail: "Unit A-301 is currently Dirty",
      instance: "/api/v1/admin/stays/check-in",
      errorCode: "unit.not_clean",
      traceId: "00-trace-id-1234",
    };

    expect(isProblemDetails(rawProblem)).toBe(true);
    expect(parseProblemDetails(rawProblem)).toEqual(rawProblem);
    expect(isProblemDetails("just a string")).toBe(false);
  });

  it("should correctly map standard errorCodes to i18n keys", () => {
    expect(getErrorCodeKey("unit.not_clean")).toBe("errors.unit_not_clean");
    expect(getErrorCodeKey("shift.not_open")).toBe("errors.shift_not_open");
    expect(getErrorCodeKey("reservation.hold_expired")).toBe("errors.reservation_hold_expired");
    expect(getErrorCodeKey("meter.rollover_unconfirmed")).toBe("errors.meter_rollover_unconfirmed");
  });

  it("should map every standard errorCode (unit.not_clean, shift.not_open, reservation.hold_expired, meter.rollover_unconfirmed) to localized message", () => {
    // 1. unit.not_clean
    const unitCleanProblem: ProblemDetailsResponse = {
      type: "https://tan-pms.internal/errors/unit.not_clean",
      title: "Unit not clean",
      status: 409,
      detail: "Room is not clean",
      errorCode: "unit.not_clean",
      traceId: "test-trace",
    };
    expect(getLocalizedErrorMessage(unitCleanProblem, "th")).toBe(thMessages.errors.unit_not_clean);
    expect(getLocalizedErrorMessage(unitCleanProblem, "en")).toBe(enMessages.errors.unit_not_clean);

    // 2. shift.not_open
    const shiftProblem: ProblemDetailsResponse = {
      type: "https://tan-pms.internal/errors/shift.not_open",
      title: "Shift not open",
      status: 409,
      detail: "No active open shift",
      errorCode: "shift.not_open",
      traceId: "test-trace",
    };
    expect(getLocalizedErrorMessage(shiftProblem, "th")).toBe(thMessages.errors.shift_not_open);
    expect(getLocalizedErrorMessage(shiftProblem, "en")).toBe(enMessages.errors.shift_not_open);

    // 3. reservation.hold_expired
    const holdExpiredProblem: ProblemDetailsResponse = {
      type: "https://tan-pms.internal/errors/reservation.hold_expired",
      title: "Hold expired",
      status: 409,
      detail: "Hold TTL expired",
      errorCode: "reservation.hold_expired",
      traceId: "test-trace",
    };
    expect(getLocalizedErrorMessage(holdExpiredProblem, "th")).toBe(thMessages.errors.reservation_hold_expired);
    expect(getLocalizedErrorMessage(holdExpiredProblem, "en")).toBe(enMessages.errors.reservation_hold_expired);

    // 4. meter.rollover_unconfirmed
    const rolloverProblem: ProblemDetailsResponse = {
      type: "https://tan-pms.internal/errors/meter.rollover_unconfirmed",
      title: "Rollover unconfirmed",
      status: 409,
      detail: "Meter rolled over without confirmation",
      errorCode: "meter.rollover_unconfirmed",
      traceId: "test-trace",
    };
    expect(getLocalizedErrorMessage(rolloverProblem, "th")).toBe(thMessages.errors.meter_rollover_unconfirmed);
    expect(getLocalizedErrorMessage(rolloverProblem, "en")).toBe(enMessages.errors.meter_rollover_unconfirmed);
  });
});
