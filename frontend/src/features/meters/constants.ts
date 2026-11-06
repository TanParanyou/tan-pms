import type { MeterReadingRow } from "./types";

export const INITIAL_METER_ROWS: MeterReadingRow[] = [
  {
    unitId: "u-101",
    unitNumber: "A-101",
    previousWater: 1420.0,
    currentWater: "1438.5",
    previousElectric: 8940,
    currentElectric: "9120",
    isRolloverConfirmed: false,
  },
  {
    unitId: "u-201",
    unitNumber: "A-201",
    previousWater: 2150.0,
    currentWater: "2172.0",
    previousElectric: 11200,
    currentElectric: "11410",
    isRolloverConfirmed: false,
  },
  {
    unitId: "u-301",
    unitNumber: "A-301",
    previousWater: 3040.0,
    currentWater: "3020.0", // Rollover condition
    previousElectric: 14500,
    currentElectric: "14850",
    isRolloverConfirmed: false,
  },
];
