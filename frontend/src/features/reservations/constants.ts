import type {
  PropertyRefDto,
  CustomerRefDto,
  UnitTypeRefDto,
  AssignableUnitOptionDto,
  UnitTypeAvailabilityDto,
  ReservationItemDto,
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
    fullName: "Vipaporn Kaewmanee",
    maskedNationalId: "3-1005-XXXXX-11-8",
  },
  {
    id: "cus-03",
    fullName: "Akarapol Rattanakul",
    maskedNationalId: "1-1020-XXXXX-33-4",
  },
];

export const SAMPLE_UNIT_TYPES: UnitTypeRefDto[] = [
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

export const SAMPLE_ASSIGNABLE_UNITS: Record<string, AssignableUnitOptionDto[]> = {
  "ut-01": [
    {
      id: "u-101",
      unitNumber: "A-101",
      buildingName: {
        th: "อาคาร A",
        en: "Building A",
      },
      floorNumber: 1,
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
      conditionStatus: "Clean",
    },
    {
      id: "u-103",
      unitNumber: "A-103",
      buildingName: {
        th: "อาคาร A",
        en: "Building A",
      },
      floorNumber: 1,
      conditionStatus: "Clean",
    },
  ],
  "ut-02": [
    {
      id: "u-201",
      unitNumber: "A-201",
      buildingName: {
        th: "อาคาร A",
        en: "Building A",
      },
      floorNumber: 2,
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
      conditionStatus: "Clean",
    },
  ],
  "ut-03": [
    {
      id: "u-301",
      unitNumber: "A-301",
      buildingName: {
        th: "อาคาร A",
        en: "Building A",
      },
      floorNumber: 3,
      conditionStatus: "Clean",
    },
  ],
};

export const INITIAL_AVAILABILITY_ITEMS: UnitTypeAvailabilityDto[] = [
  {
    unitType: SAMPLE_UNIT_TYPES[0],
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    totalPhysicalUnits: 8,
    unassignedQuotaHeld: 1,
    netAvailableQuota: 5,
    turnaroundBufferMinutes: 30,
    estimatedRoomRate: 450,
    estimatedDepositAmount: 500,
    availableUnits: SAMPLE_ASSIGNABLE_UNITS["ut-01"],
  },
  {
    unitType: SAMPLE_UNIT_TYPES[1],
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    totalPhysicalUnits: 6,
    unassignedQuotaHeld: 2,
    netAvailableQuota: 3,
    turnaroundBufferMinutes: 30,
    estimatedRoomRate: 590,
    estimatedDepositAmount: 500,
    availableUnits: SAMPLE_ASSIGNABLE_UNITS["ut-02"],
  },
  {
    unitType: SAMPLE_UNIT_TYPES[2],
    supportedStayModes: ["Daily", "Monthly"],
    totalPhysicalUnits: 4,
    unassignedQuotaHeld: 1,
    netAvailableQuota: 2,
    turnaroundBufferMinutes: 45,
    estimatedRoomRate: 890,
    estimatedDepositAmount: 1000,
    availableUnits: SAMPLE_ASSIGNABLE_UNITS["ut-03"],
  },
];

export const INITIAL_RESERVATIONS: ReservationItemDto[] = [
  {
    id: "res-01",
    documentNumber: "BKK01-RES-2611-0001",
    property: SAMPLE_PROPERTY,
    customer: SAMPLE_CUSTOMERS[0],
    unitType: SAMPLE_UNIT_TYPES[0],
    assignedUnit: {
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
    },
    stayMode: "Hourly",
    slotStartAt: "2026-11-07T14:00:00Z",
    slotEndAt: "2026-11-07T17:00:00Z",
    effectiveBlockedEndAt: "2026-11-07T17:30:00Z",
    holdExpiresAt: "2026-11-07T14:15:00Z",
    depositAmount: 500,
    status: "Confirmed",
  },
  {
    id: "res-02",
    documentNumber: "BKK01-RES-2611-0002",
    property: SAMPLE_PROPERTY,
    customer: SAMPLE_CUSTOMERS[1],
    unitType: SAMPLE_UNIT_TYPES[1],
    stayMode: "Daily",
    slotStartAt: "2026-11-08T14:00:00Z",
    slotEndAt: "2026-11-10T12:00:00Z",
    effectiveBlockedEndAt: "2026-11-10T12:00:00Z",
    holdExpiresAt: "2026-11-07T18:45:00Z",
    depositAmount: 1000,
    paymentSlipFileKey: "slips/res-0002-slip.jpg",
    status: "PendingVerification",
  },
  {
    id: "res-03",
    documentNumber: "BKK01-RES-2611-0003",
    property: SAMPLE_PROPERTY,
    customer: SAMPLE_CUSTOMERS[2],
    unitType: SAMPLE_UNIT_TYPES[2],
    stayMode: "Monthly",
    slotStartAt: "2026-12-01T00:00:00Z",
    slotEndAt: "2027-05-31T23:59:59Z",
    effectiveBlockedEndAt: "2027-05-31T23:59:59Z",
    holdExpiresAt: "2026-11-07T19:00:00Z",
    depositAmount: 22000,
    status: "Hold",
  },
];
