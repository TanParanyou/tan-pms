import type {
  HourlyPackageConfigDto,
  HourlySimulationQuoteDto,
  UtilityTariffItemDto,
  UtilitySimulationQuoteDto,
  TaxProfileItemDto,
  TaxSimulationQuoteDto,
} from "../types";

export function roundMidpointAwayFromZero(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const absValue = Math.abs(value);
  return sign * (Math.round((absValue + Number.EPSILON) * 100) / 100);
}

export function calculateHourlySimulationQuote(
  durationMinutes: number,
  hourlyPackage: HourlyPackageConfigDto
): HourlySimulationQuoteDto {
  const safeDuration = Math.max(0, durationMinutes);
  const baseMinutes = hourlyPackage.basePackageHours * 60;
  const graceThreshold = baseMinutes + hourlyPackage.gracePeriodMinutes;

  let extraHours = 0;
  let rawCharge = hourlyPackage.basePackagePrice;

  if (safeDuration > graceThreshold) {
    const excessMinutes = safeDuration - graceThreshold;
    extraHours = Math.ceil(excessMinutes / 60);
    rawCharge =
      hourlyPackage.basePackagePrice +
      extraHours * hourlyPackage.additionalHourPrice;
  }

  const isCappedToDailyRate =
    hourlyPackage.autoCapToDailyRate > 0 &&
    rawCharge > hourlyPackage.autoCapToDailyRate;

  const finalHourlyRoomCharge = isCappedToDailyRate
    ? hourlyPackage.autoCapToDailyRate
    : rawCharge;

  return {
    durationMinutes: safeDuration,
    extraHours,
    rawCharge: roundMidpointAwayFromZero(rawCharge),
    finalHourlyRoomCharge: roundMidpointAwayFromZero(finalHourlyRoomCharge),
    isCappedToDailyRate,
    turnaroundBufferMinutes: hourlyPackage.turnaroundBufferMinutes,
  };
}

export interface ExtendedUtilitySimulationQuoteDto
  extends UtilitySimulationQuoteDto {
  isRolloverUnconfirmed: boolean;
}

export function calculateUtilitySimulationQuote(
  utilityType: "Water" | "Electric",
  previousReading: number,
  currentReading: number,
  isRolloverConfirmed: boolean,
  tariff: UtilityTariffItemDto,
  occupantCount: number = 1
): ExtendedUtilitySimulationQuoteDto {
  let usageUnits = 0;
  let usedRollover = false;
  let isRolloverUnconfirmed = false;

  if (currentReading >= previousReading) {
    usageUnits = currentReading - previousReading;
    usedRollover = false;
    isRolloverUnconfirmed = false;
  } else {
    // Current reading is less than previous reading (rollover condition)
    if (!isRolloverConfirmed) {
      usageUnits = 0;
      usedRollover = false;
      isRolloverUnconfirmed = true;
    } else {
      const maxDigits = Math.max(1, tariff.meterMaxDigits || 4);
      const rolloverCap = Math.pow(10, maxDigits);
      usageUnits = rolloverCap - previousReading + currentReading;
      usedRollover = true;
      isRolloverUnconfirmed = false;
    }
  }

  let chargeAmount = 0;

  if (!isRolloverUnconfirmed) {
    if (tariff.billingMode === "PerUnit") {
      const calculated = usageUnits * tariff.ratePerUnit;
      chargeAmount = Math.max(calculated, tariff.minimumChargeAmount || 0);
    } else if (tariff.billingMode === "MinimumUnits") {
      if (usageUnits <= tariff.includedUnits) {
        chargeAmount = tariff.baseMinimumAmount;
      } else {
        const excessUnits = usageUnits - tariff.includedUnits;
        chargeAmount =
          tariff.baseMinimumAmount + excessUnits * tariff.ratePerUnit;
      }
    } else {
      // FlatRate
      if (tariff.flatRatePerOccupant) {
        const safeOccupants = Math.max(1, occupantCount);
        chargeAmount = tariff.flatRateAmount * safeOccupants;
      } else {
        chargeAmount = tariff.flatRateAmount;
      }
    }
  }

  return {
    utilityType,
    usageUnits: roundMidpointAwayFromZero(usageUnits),
    chargeAmount: roundMidpointAwayFromZero(chargeAmount),
    usedRollover,
    isRolloverUnconfirmed,
  };
}

export function calculateTaxSimulationQuote(
  sampleLineAmount: number,
  taxProfile: TaxProfileItemDto,
  applyWithholdingTax: boolean
): TaxSimulationQuoteDto {
  const safeLineAmount = Math.max(0, sampleLineAmount);
  const vatRate = (taxProfile.vatRatePercent || 0) / 100;

  let subTotal = safeLineAmount;
  let vatAmount = 0;
  let invoiceTotal = safeLineAmount;

  if (taxProfile.taxMode === "Exempt") {
    subTotal = safeLineAmount;
    vatAmount = 0;
    invoiceTotal = safeLineAmount;
  } else if (taxProfile.taxMode === "VatIncluded") {
    invoiceTotal = safeLineAmount;
    subTotal = roundMidpointAwayFromZero(invoiceTotal / (1 + vatRate));
    vatAmount = roundMidpointAwayFromZero(invoiceTotal - subTotal);
  } else {
    // VatExcluded
    subTotal = safeLineAmount;
    vatAmount = roundMidpointAwayFromZero(subTotal * vatRate);
    invoiceTotal = roundMidpointAwayFromZero(subTotal + vatAmount);
  }

  const withholdingTaxPercent = applyWithholdingTax
    ? taxProfile.defaultWithholdingTaxPercent || 0
    : 0;
  const whtRate = withholdingTaxPercent / 100;
  const withholdingTaxAmount = roundMidpointAwayFromZero(subTotal * whtRate);
  const netPayable = roundMidpointAwayFromZero(
    invoiceTotal - withholdingTaxAmount
  );

  return {
    taxMode: taxProfile.taxMode,
    vatRatePercent: taxProfile.vatRatePercent,
    subTotal,
    vatAmount,
    invoiceTotal,
    withholdingTaxPercent,
    withholdingTaxAmount,
    netPayable,
  };
}
