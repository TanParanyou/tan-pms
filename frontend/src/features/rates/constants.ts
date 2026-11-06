import type {
  RatePlanItemDto,
  UtilityTariffItemDto,
  TaxProfileItemDto,
  UnitTypeRefDto,
} from "./types";

export const SAMPLE_UNIT_TYPE_REFS: UnitTypeRefDto[] = [
  {
    id: "ut-01",
    code: "UT-STU",
    name: {
      th: "ห้องสตูดิโอมาตรฐาน (Studio)",
      en: "Standard Studio",
    },
    areaSqm: 28,
  },
  {
    id: "ut-02",
    code: "UT-DLX",
    name: {
      th: "ห้องดีลักซ์ 1 ห้องนอน (Deluxe)",
      en: "Deluxe 1-Bedroom",
    },
    areaSqm: 35,
  },
  {
    id: "ut-03",
    code: "UT-SUT",
    name: {
      th: "ห้องสวีทส์ 2 ห้องนอน (Executive Suite)",
      en: "Executive Suite 2-Bedroom",
    },
    areaSqm: 48,
  },
];

export const INITIAL_RATE_PLANS: RatePlanItemDto[] = [
  {
    id: "rp-01",
    code: "RP-STD-2026",
    name: {
      th: "แผนราคาห้องพักสตูดิโอมาตรฐาน (RP-STD)",
      en: "Standard Studio Rate Plan",
    },
    unitType: SAMPLE_UNIT_TYPE_REFS[0],
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    hourlyPackage: {
      basePackageHours: 3,
      basePackagePrice: 450,
      additionalHourPrice: 120,
      gracePeriodMinutes: 15,
      autoCapToDailyRate: 1200,
      turnaroundBufferMinutes: 30,
    },
    dailyRate: {
      weekdayRate: 890,
      weekendRate: 1090,
      holidaySurchargeAmount: 200,
      extraGuestPrice: 250,
    },
    monthlyRate: {
      monthlyRentRate: 8500,
      minimumLeaseMonths: 6,
      securityDepositMonths: 2,
    },
    isActive: true,
  },
  {
    id: "rp-02",
    code: "RP-DLX-2026",
    name: {
      th: "แผนราคาดีลักซ์ 1 ห้องนอน (RP-DLX)",
      en: "Deluxe 1-Bedroom Rate Plan",
    },
    unitType: SAMPLE_UNIT_TYPE_REFS[1],
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    hourlyPackage: {
      basePackageHours: 3,
      basePackagePrice: 590,
      additionalHourPrice: 150,
      gracePeriodMinutes: 15,
      autoCapToDailyRate: 1500,
      turnaroundBufferMinutes: 30,
    },
    dailyRate: {
      weekdayRate: 1290,
      weekendRate: 1490,
      holidaySurchargeAmount: 300,
      extraGuestPrice: 300,
    },
    monthlyRate: {
      monthlyRentRate: 12000,
      minimumLeaseMonths: 12,
      securityDepositMonths: 2,
    },
    isActive: true,
  },
  {
    id: "rp-03",
    code: "RP-SUT-2026",
    name: {
      th: "แผนราคาเอ็กเซกคิวทีฟสวีทส์ (RP-SUT)",
      en: "Executive Suite Rate Plan",
    },
    unitType: SAMPLE_UNIT_TYPE_REFS[2],
    supportedStayModes: ["Daily", "Monthly"],
    hourlyPackage: {
      basePackageHours: 3,
      basePackagePrice: 890,
      additionalHourPrice: 250,
      gracePeriodMinutes: 15,
      autoCapToDailyRate: 2500,
      turnaroundBufferMinutes: 45,
    },
    dailyRate: {
      weekdayRate: 2190,
      weekendRate: 2490,
      holidaySurchargeAmount: 500,
      extraGuestPrice: 400,
    },
    monthlyRate: {
      monthlyRentRate: 22000,
      minimumLeaseMonths: 12,
      securityDepositMonths: 2,
    },
    isActive: true,
  },
];

export const INITIAL_UTILITY_TARIFFS: UtilityTariffItemDto[] = [
  {
    id: "tariff-water-01",
    utilityType: "Water",
    name: {
      th: "อัตราค่าน้ำประปาตามหน่วยจริง (ขั้นต่ำ 100 บาท)",
      en: "Water Tariff (Per Unit, Min 100 THB)",
    },
    billingMode: "PerUnit",
    ratePerUnit: 18,
    minimumChargeAmount: 100,
    includedUnits: 0,
    baseMinimumAmount: 0,
    flatRateAmount: 0,
    flatRatePerOccupant: false,
    meterMaxDigits: 4,
  },
  {
    id: "tariff-elec-01",
    utilityType: "Electric",
    name: {
      th: "อัตราค่าไฟฟ้าตามหน่วยจริง (7 บาท/หน่วย)",
      en: "Electric Tariff (Per Unit, 7 THB/kWh)",
    },
    billingMode: "PerUnit",
    ratePerUnit: 7,
    minimumChargeAmount: 0,
    includedUnits: 0,
    baseMinimumAmount: 0,
    flatRateAmount: 0,
    flatRatePerOccupant: false,
    meterMaxDigits: 5,
  },
];

export const INITIAL_TAX_PROFILES: TaxProfileItemDto[] = [
  {
    id: "tax-01",
    chargeCategoryCode: "MONTHLY_ROOM_RENT",
    name: {
      th: "ค่าเช่าห้องพักรายเดือน (ยกเว้นภาษีมูลค่าเพิ่ม)",
      en: "Monthly Room Rent (VAT Exempt)",
    },
    taxMode: "Exempt",
    vatRatePercent: 0,
    defaultWithholdingTaxPercent: 5,
    isActive: true,
  },
  {
    id: "tax-02",
    chargeCategoryCode: "SHORT_STAY_ROOM",
    name: {
      th: "ค่าห้องพักรายชั่วโมงและรายวัน (รวม VAT 7%)",
      en: "Short Stay Room Charge (VAT Included 7%)",
    },
    taxMode: "VatIncluded",
    vatRatePercent: 7,
    defaultWithholdingTaxPercent: 0,
    isActive: true,
  },
  {
    id: "tax-03",
    chargeCategoryCode: "FURNITURE_RENTAL",
    name: {
      th: "ค่าเช่าเฟอร์นิเจอร์และอุปกรณ์ (แยก VAT 7%)",
      en: "Furniture & Equipment Rental (VAT Excluded 7%)",
    },
    taxMode: "VatExcluded",
    vatRatePercent: 7,
    defaultWithholdingTaxPercent: 5,
    isActive: true,
  },
  {
    id: "tax-04",
    chargeCategoryCode: "UTILITY_WATER_ELECTRIC",
    name: {
      th: "ค่าน้ำประปาและค่าไฟฟ้าส่วนบุคคล (แยก VAT 7%)",
      en: "Utility Water & Electric Charges (VAT Excluded 7%)",
    },
    taxMode: "VatExcluded",
    vatRatePercent: 7,
    defaultWithholdingTaxPercent: 0,
    isActive: true,
  },
];
