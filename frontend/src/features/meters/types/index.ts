export interface MeterReadingRow {
  unitId: string;
  unitNumber: string;
  previousWater: number;
  currentWater: string;
  previousElectric: number;
  currentElectric: string;
  isRolloverConfirmed: boolean;
}
