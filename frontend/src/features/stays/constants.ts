import type {
  PropertyRefDto,
  CustomerRefDto,
  StayDetailDto,
  RegulatoryGuestRowDto,
  AssignableUnitOptionDto,
  LocalizedTextDto,
} from "./types";

export const SAMPLE_PROPERTY: PropertyRefDto = {
  id: "prop-01",
  code: "BKK01",
  name: {
    th: "โรงแรมแทน เรสซิเดนซ์ อโศก",
    en: "Tan Residence Asoke",
  },
};

export const SAMPLE_CUSTOMERS: CustomerRefDto[] = [
  {
    id: "cus-01",
    fullName: "Somchai Jaidee",
    maskedNationalId: "1-1004-XXXXX-91-2",
  },
  {
    id: "cus-02",
    fullName: "John Doe",
    maskedNationalId: "US-PASS-XXXX789",
  },
  {
    id: "cus-03",
    fullName: "Tanaka Kenji",
    maskedNationalId: "JP-PASS-XXXX123",
  },
  {
    id: "cus-04",
    fullName: "Vipaporn Kaewmanee",
    maskedNationalId: "3-1005-XXXXX-11-8",
  },
];

export const SAMPLE_UNITS_FOR_STAY: (AssignableUnitOptionDto & { unitTypeName: LocalizedTextDto })[] = [
  {
    id: "u-101",
    unitNumber: "A-101",
    buildingName: {
      th: "อาคาร A",
      en: "Building A",
    },
    floorNumber: 1,
    unitTypeName: {
      th: "ห้องสตูดิโอมาตรฐาน (Studio)",
      en: "Standard Studio",
    },
    conditionStatus: "Clean",
  },
  {
    id: "u-102",
    unitNumber: "A-102",
    buildingName: {
      th: "อาคาร A",
      en: "Building A",
    },
    floorNumber: 1,
    unitTypeName: {
      th: "ห้องสตูดิโอมาตรฐาน (Studio)",
      en: "Standard Studio",
    },
    conditionStatus: "Dirty",
  },
  {
    id: "u-201",
    unitNumber: "A-201",
    buildingName: {
      th: "อาคาร A",
      en: "Building A",
    },
    floorNumber: 2,
    unitTypeName: {
      th: "ห้องดีลักซ์ 1 ห้องนอน (Deluxe)",
      en: "Deluxe 1-Bedroom",
    },
    conditionStatus: "Clean",
  },
  {
    id: "u-202",
    unitNumber: "A-202",
    buildingName: {
      th: "อาคาร A",
      en: "Building A",
    },
    floorNumber: 2,
    unitTypeName: {
      th: "ห้องดีลักซ์ 1 ห้องนอน (Deluxe)",
      en: "Deluxe 1-Bedroom",
    },
    conditionStatus: "Clean",
  },
];

export const SAMPLE_UNITS_FOR_STAY_MAP = Object.fromEntries(
  SAMPLE_UNITS_FOR_STAY.map((u) => [u.id, u])
);

export const INITIAL_STAYS: StayDetailDto[] = [
  {
    id: "sty-01",
    documentNumber: "BKK01-STY-2611-0001",
    property: SAMPLE_PROPERTY,
    unit: SAMPLE_UNITS_FOR_STAY[0],
    customer: SAMPLE_CUSTOMERS[0],
    reservationDocumentNumber: "BKK01-RES-2611-0001",
    stayMode: "Hourly",
    status: "Active",
    checkInAt: "2026-11-07T13:30:00Z",
    expectedCheckOutAt: "2026-11-07T16:30:00Z",
    checkOutAt: null,
    remainingMinutes: 45,
    isOvertime: false,
    keyDepositAmount: 500,
    keyDepositBalance: 500,
    folio: {
      id: "fol-01",
      charges: [
        {
          id: "chg-01-1",
          description: {
            th: "ค่าห้องพักรายชั่วโมง (แพ็กเกจ 3 ชม.)",
            en: "Hourly Room Charge (3-Hour Package)",
          },
          amount: 450,
          taxMode: "VatIncluded",
        },
      ],
      totalCharges: 450,
      totalPayments: 450,
      balanceDue: 0,
    },
    occupants: [
      {
        id: "occ-01",
        fullName: "Somchai Jaidee",
        nationalityCode: "THA",
        maskedIdentityNumber: "1-1004-XXXXX-91-2",
        isPrimaryOccupant: true,
        vehicleLicensePlate: "1AB-9999",
      },
    ],
    generatedHousekeepingTaskStatus: null,
  },
  {
    id: "sty-02",
    documentNumber: "BKK01-STY-2611-0002",
    property: SAMPLE_PROPERTY,
    unit: SAMPLE_UNITS_FOR_STAY[1],
    customer: SAMPLE_CUSTOMERS[1],
    reservationDocumentNumber: null,
    stayMode: "Hourly",
    status: "Active",
    checkInAt: "2026-11-07T12:00:00Z",
    expectedCheckOutAt: "2026-11-07T15:00:00Z",
    checkOutAt: null,
    remainingMinutes: -15,
    isOvertime: true,
    keyDepositAmount: 500,
    keyDepositBalance: 500,
    folio: {
      id: "fol-02",
      charges: [
        {
          id: "chg-02-1",
          description: {
            th: "ค่าห้องพักรายชั่วโมง (3 ชม.)",
            en: "Hourly Room Charge (3 hrs)",
          },
          amount: 450,
          taxMode: "VatIncluded",
        },
        {
          id: "chg-02-2",
          description: {
            th: "ค่าต่อเวลาเกินกำหนด 1 ชั่วโมง",
            en: "Overtime Charge (1 hr)",
          },
          amount: 120,
          taxMode: "VatIncluded",
        },
      ],
      totalCharges: 570,
      totalPayments: 450,
      balanceDue: 120,
    },
    occupants: [
      {
        id: "occ-02-1",
        fullName: "John Doe",
        nationalityCode: "USA",
        maskedIdentityNumber: "US-PASS-XXXX789",
        isPrimaryOccupant: true,
        vehicleLicensePlate: null,
      },
      {
        id: "occ-02-2",
        fullName: "Suda Jaidee",
        nationalityCode: "THA",
        maskedIdentityNumber: "3-1005-XXXXX-22-1",
        isPrimaryOccupant: false,
        vehicleLicensePlate: null,
      },
    ],
    generatedHousekeepingTaskStatus: null,
  },
  {
    id: "sty-03",
    documentNumber: "BKK01-STY-2611-0003",
    property: SAMPLE_PROPERTY,
    unit: SAMPLE_UNITS_FOR_STAY[2],
    customer: SAMPLE_CUSTOMERS[2],
    reservationDocumentNumber: "BKK01-RES-2611-0002",
    stayMode: "Daily",
    status: "Active",
    checkInAt: "2026-11-07T14:00:00Z",
    expectedCheckOutAt: "2026-11-08T12:00:00Z",
    checkOutAt: null,
    remainingMinutes: 1260,
    isOvertime: false,
    keyDepositAmount: 1000,
    keyDepositBalance: 1000,
    folio: {
      id: "fol-03",
      charges: [
        {
          id: "chg-03-1",
          description: {
            th: "ค่าห้องพักรายวัน (1 คืน)",
            en: "Daily Room Charge (1 Night)",
          },
          amount: 1290,
          taxMode: "VatIncluded",
        },
        {
          id: "chg-03-2",
          description: {
            th: "มินิบาร์และเครื่องดื่ม",
            en: "Minibar & Refreshments",
          },
          amount: 350,
          taxMode: "VatIncluded",
        },
      ],
      totalCharges: 1640,
      totalPayments: 1640,
      balanceDue: 0,
    },
    occupants: [
      {
        id: "occ-03",
        fullName: "Tanaka Kenji",
        nationalityCode: "JPN",
        maskedIdentityNumber: "JP-PASS-XXXX123",
        isPrimaryOccupant: true,
        vehicleLicensePlate: "5CD-1234",
      },
    ],
    generatedHousekeepingTaskStatus: null,
  },
  {
    id: "sty-04",
    documentNumber: "BKK01-STY-2611-0004",
    property: SAMPLE_PROPERTY,
    unit: SAMPLE_UNITS_FOR_STAY[3],
    customer: SAMPLE_CUSTOMERS[3],
    reservationDocumentNumber: null,
    stayMode: "Daily",
    status: "CheckedOut",
    checkInAt: "2026-11-06T14:00:00Z",
    expectedCheckOutAt: "2026-11-07T12:00:00Z",
    checkOutAt: "2026-11-07T11:45:00Z",
    remainingMinutes: 0,
    isOvertime: false,
    keyDepositAmount: 1000,
    keyDepositBalance: 0,
    folio: {
      id: "fol-04",
      charges: [
        {
          id: "chg-04-1",
          description: {
            th: "ค่าห้องพักรายวัน (1 คืน)",
            en: "Daily Room Charge (1 Night)",
          },
          amount: 1290,
          taxMode: "VatIncluded",
        },
      ],
      totalCharges: 1290,
      totalPayments: 1290,
      balanceDue: 0,
    },
    occupants: [
      {
        id: "occ-04",
        fullName: "Vipaporn Kaewmanee",
        nationalityCode: "THA",
        maskedIdentityNumber: "3-1005-XXXXX-11-8",
        isPrimaryOccupant: true,
        vehicleLicensePlate: null,
      },
    ],
    generatedHousekeepingTaskStatus: "Pending",
  },
];

export const INITIAL_REGULATORY_GUEST_ROWS: RegulatoryGuestRowDto[] = [
  {
    occupantId: "occ-01",
    sourceDocumentNumber: "BKK01-STY-2611-0001",
    unitNumber: "A-101",
    fullName: "Somchai Jaidee",
    nationalityCode: "THA",
    identityNumber: "1-1004-00123-91-2",
    isPrimaryOccupant: true,
    vehicleLicensePlate: "1AB-9999",
    checkInAt: "2026-11-07T13:30:00Z",
    checkOutAt: null,
    stayMode: "Hourly",
  },
  {
    occupantId: "occ-02-1",
    sourceDocumentNumber: "BKK01-STY-2611-0002",
    unitNumber: "A-102",
    fullName: "John Doe",
    nationalityCode: "USA",
    identityNumber: "US-PASS-9876543",
    isPrimaryOccupant: true,
    vehicleLicensePlate: null,
    checkInAt: "2026-11-07T12:00:00Z",
    checkOutAt: null,
    stayMode: "Hourly",
  },
  {
    occupantId: "occ-02-2",
    sourceDocumentNumber: "BKK01-STY-2611-0002",
    unitNumber: "A-102",
    fullName: "Suda Jaidee",
    nationalityCode: "THA",
    identityNumber: "3-1005-00456-22-1",
    isPrimaryOccupant: false,
    vehicleLicensePlate: null,
    checkInAt: "2026-11-07T12:00:00Z",
    checkOutAt: null,
    stayMode: "Hourly",
  },
  {
    occupantId: "occ-03",
    sourceDocumentNumber: "BKK01-STY-2611-0003",
    unitNumber: "A-201",
    fullName: "Tanaka Kenji",
    nationalityCode: "JPN",
    identityNumber: "JP-PASS-1122334",
    isPrimaryOccupant: true,
    vehicleLicensePlate: "5CD-1234",
    checkInAt: "2026-11-07T14:00:00Z",
    checkOutAt: null,
    stayMode: "Daily",
  },
  {
    occupantId: "occ-04",
    sourceDocumentNumber: "BKK01-STY-2611-0004",
    unitNumber: "A-202",
    fullName: "Vipaporn Kaewmanee",
    nationalityCode: "THA",
    identityNumber: "3-1005-00999-11-8",
    isPrimaryOccupant: true,
    vehicleLicensePlate: null,
    checkInAt: "2026-11-06T14:00:00Z",
    checkOutAt: "2026-11-07T11:45:00Z",
    stayMode: "Daily",
  },
];

export const STAY_CREATE_DEFAULTS = {
  unitId: "",
  customerId: "",
  stayMode: "Hourly" as "Hourly" | "Daily",
  durationHours: 3,
  durationDays: 1,
  dirtyOverrideReason: "",
  primaryGuestName: "",
  primaryNationality: "",
  primaryIdNumber: "",
  primaryLicensePlate: "",
  keyDepositAmount: 500,
};
export const CHECK_IN_STAY_MODES = ["Hourly", "Daily"] as const;
export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
