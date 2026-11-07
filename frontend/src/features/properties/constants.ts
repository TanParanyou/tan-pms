import type {
  BuildingDetailDto,
  UnitTypeDetailDto,
  UnitMasterItemDto,
  UnitAssetDto,
} from "./types";

export const DEFAULT_PROPERTY_NAME = {
  th: "แทน เรสซิเดนซ์ พระราม 9",
  en: "Tan Residence Rama 9",
};

export const INITIAL_BUILDINGS: BuildingDetailDto[] = [
  {
    id: "bld-01",
    code: "BLD-A",
    name: {
      th: "อาคาร A (เรสซิเดนซ์)",
      en: "Building A (Residence)",
    },
    floors: [
      {
        id: "flr-a-01",
        floorNumber: 1,
        name: {
          th: "ชั้น 1",
          en: "Floor 1",
        },
        unitCount: 8,
      },
      {
        id: "flr-a-02",
        floorNumber: 2,
        name: {
          th: "ชั้น 2",
          en: "Floor 2",
        },
        unitCount: 12,
      },
      {
        id: "flr-a-03",
        floorNumber: 3,
        name: {
          th: "ชั้น 3",
          en: "Floor 3",
        },
        unitCount: 12,
      },
    ],
  },
  {
    id: "bld-02",
    code: "BLD-B",
    name: {
      th: "อาคาร B (สวีทส์)",
      en: "Building B (Suites)",
    },
    floors: [
      {
        id: "flr-b-01",
        floorNumber: 1,
        name: {
          th: "ชั้น 1",
          en: "Floor 1",
        },
        unitCount: 6,
      },
      {
        id: "flr-b-02",
        floorNumber: 2,
        name: {
          th: "ชั้น 2",
          en: "Floor 2",
        },
        unitCount: 10,
      },
    ],
  },
];

export const INITIAL_UNIT_TYPES: UnitTypeDetailDto[] = [
  {
    id: "ut-01",
    code: "UT-STU",
    name: {
      th: "สตูดิโอ ดีลักซ์",
      en: "Studio Deluxe",
    },
    description: {
      th: "ห้องพักสตูดิโอ ขนาด 28 ตร.ม. พร้อมระเบียง",
      en: "Studio room with private balcony (28 sqm)",
    },
    areaSqm: 28,
    totalQuotaUnits: 20,
    supportedStayModes: ["Hourly", "Daily"],
    hourlyBasePackagePrice: 450,
    dailyRate: 1200,
    monthlyRentRate: 9500,
  },
  {
    id: "ut-02",
    code: "UT-1BED",
    name: {
      th: "1 ห้องนอน สแตนดาร์ด",
      en: "Standard 1-Bed",
    },
    description: {
      th: "1 ห้องนอน 1 ห้องนั่งเล่น ขนาด 32 ตร.ม.",
      en: "1 Bedroom with living area (32 sqm)",
    },
    areaSqm: 32,
    totalQuotaUnits: 18,
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    hourlyBasePackagePrice: 550,
    dailyRate: 1500,
    monthlyRentRate: 12500,
  },
  {
    id: "ut-03",
    code: "UT-2BED",
    name: {
      th: "2 ห้องนอน แฟมิลี่",
      en: "Family 2-Bed",
    },
    description: {
      th: "2 ห้องนอน 2 ห้องน้ำ ขนาด 54 ตร.ม.",
      en: "2 Bedrooms 2 Bathrooms family suite (54 sqm)",
    },
    areaSqm: 54,
    totalQuotaUnits: 10,
    supportedStayModes: ["Daily", "Monthly"],
    hourlyBasePackagePrice: 850,
    dailyRate: 2800,
    monthlyRentRate: 24000,
  },
];

export const SAMPLE_ROOM_ASSETS: UnitAssetDto[] = [
  {
    id: "ast-01",
    assetCode: "AST-00001",
    name: {
      th: "เครื่องปรับอากาศ Daikin Inverter 12000 BTU",
      en: "Daikin Inverter AC 12,000 BTU",
    },
    replacementCostAmount: 18900,
  },
  {
    id: "ast-02",
    assetCode: "AST-00002",
    name: {
      th: "สมาร์ททีวี Samsung 43 นิ้ว 4K",
      en: "Samsung Smart TV 43\" 4K",
    },
    replacementCostAmount: 12500,
  },
  {
    id: "ast-03",
    assetCode: "AST-00003",
    name: {
      th: "ชุดคีย์การ์ดและกุญแจห้องพัก",
      en: "Room Keycard & Physical Key Set",
    },
    replacementCostAmount: 500,
  },
];

export const INITIAL_UNIT_MASTER_ITEMS: UnitMasterItemDto[] = [
  {
    id: "u-101",
    unitNumber: "A-101",
    building: {
      id: INITIAL_BUILDINGS[0].id,
      code: INITIAL_BUILDINGS[0].code,
      name: { ...INITIAL_BUILDINGS[0].name },
    },
    floor: {
      id: INITIAL_BUILDINGS[0].floors[0].id,
      floorNumber: INITIAL_BUILDINGS[0].floors[0].floorNumber,
      name: { ...INITIAL_BUILDINGS[0].floors[0].name },
    },
    unitType: {
      id: INITIAL_UNIT_TYPES[0].id,
      code: INITIAL_UNIT_TYPES[0].code,
      name: { ...INITIAL_UNIT_TYPES[0].name },
      areaSqm: INITIAL_UNIT_TYPES[0].areaSqm,
    },
    occupancyStatus: "Vacant",
    conditionStatus: "Clean",
    supportedStayModes: ["Hourly", "Daily"],
    assets: [
      { ...SAMPLE_ROOM_ASSETS[0] },
      { ...SAMPLE_ROOM_ASSETS[1] },
      { ...SAMPLE_ROOM_ASSETS[2] },
    ],
  },
  {
    id: "u-201",
    unitNumber: "A-201",
    building: {
      id: INITIAL_BUILDINGS[0].id,
      code: INITIAL_BUILDINGS[0].code,
      name: { ...INITIAL_BUILDINGS[0].name },
    },
    floor: {
      id: INITIAL_BUILDINGS[0].floors[1].id,
      floorNumber: INITIAL_BUILDINGS[0].floors[1].floorNumber,
      name: { ...INITIAL_BUILDINGS[0].floors[1].name },
    },
    unitType: {
      id: INITIAL_UNIT_TYPES[1].id,
      code: INITIAL_UNIT_TYPES[1].code,
      name: { ...INITIAL_UNIT_TYPES[1].name },
      areaSqm: INITIAL_UNIT_TYPES[1].areaSqm,
    },
    occupancyStatus: "Occupied",
    conditionStatus: "Clean",
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    assets: [
      { ...SAMPLE_ROOM_ASSETS[0] },
      { ...SAMPLE_ROOM_ASSETS[1] },
      { ...SAMPLE_ROOM_ASSETS[2] },
    ],
  },
  {
    id: "u-301",
    unitNumber: "A-301",
    building: {
      id: INITIAL_BUILDINGS[0].id,
      code: INITIAL_BUILDINGS[0].code,
      name: { ...INITIAL_BUILDINGS[0].name },
    },
    floor: {
      id: INITIAL_BUILDINGS[0].floors[2].id,
      floorNumber: INITIAL_BUILDINGS[0].floors[2].floorNumber,
      name: { ...INITIAL_BUILDINGS[0].floors[2].name },
    },
    unitType: {
      id: INITIAL_UNIT_TYPES[1].id,
      code: INITIAL_UNIT_TYPES[1].code,
      name: { ...INITIAL_UNIT_TYPES[1].name },
      areaSqm: INITIAL_UNIT_TYPES[1].areaSqm,
    },
    occupancyStatus: "Occupied",
    conditionStatus: "Clean",
    supportedStayModes: ["Monthly"],
    assets: [
      { ...SAMPLE_ROOM_ASSETS[0] },
      { ...SAMPLE_ROOM_ASSETS[1] },
      { ...SAMPLE_ROOM_ASSETS[2] },
    ],
  },
  {
    id: "u-302",
    unitNumber: "A-302",
    building: {
      id: INITIAL_BUILDINGS[0].id,
      code: INITIAL_BUILDINGS[0].code,
      name: { ...INITIAL_BUILDINGS[0].name },
    },
    floor: {
      id: INITIAL_BUILDINGS[0].floors[2].id,
      floorNumber: INITIAL_BUILDINGS[0].floors[2].floorNumber,
      name: { ...INITIAL_BUILDINGS[0].floors[2].name },
    },
    unitType: {
      id: INITIAL_UNIT_TYPES[1].id,
      code: INITIAL_UNIT_TYPES[1].code,
      name: { ...INITIAL_UNIT_TYPES[1].name },
      areaSqm: INITIAL_UNIT_TYPES[1].areaSqm,
    },
    occupancyStatus: "Vacant",
    conditionStatus: "Dirty",
    supportedStayModes: ["Hourly", "Daily"],
    assets: [
      { ...SAMPLE_ROOM_ASSETS[0] },
      { ...SAMPLE_ROOM_ASSETS[1] },
      { ...SAMPLE_ROOM_ASSETS[2] },
    ],
  },
];

export const BUILDING_MAP: Record<string, BuildingDetailDto> = Object.fromEntries(
  INITIAL_BUILDINGS.map((b) => [b.id, b])
);

export const UNIT_TYPE_MAP: Record<string, UnitTypeDetailDto> = Object.fromEntries(
  INITIAL_UNIT_TYPES.map((ut) => [ut.id, ut])
);

export const FLOOR_MAP: Record<string, BuildingDetailDto["floors"][number]> = Object.fromEntries(
  INITIAL_BUILDINGS.flatMap((b) => b.floors.map((f) => [f.id, f]))
);
