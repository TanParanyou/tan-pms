import type { RoomRackItemDto, PropertyRefDto } from "./types";
import { CENTRAL_PROPERTIES, DEFAULT_KEY_DEPOSIT } from "@/constants/master-data";

export { DEFAULT_KEY_DEPOSIT };
export const ADMIN_PROPERTIES: PropertyRefDto[] = [...CENTRAL_PROPERTIES];

export const AVAILABLE_WALK_IN_UNITS = [
  {
    id: "A-101",
    unitNumber: "A-101",
    unitTypeName: { th: "สตูดิโอ ดีลักซ์", en: "Studio Deluxe" },
    isClean: true,
  },
  {
    id: "A-302",
    unitNumber: "A-302",
    unitTypeName: { th: "1 ห้องนอน สแตนดาร์ด", en: "Standard 1-Bed" },
    isClean: false,
  },
] as const;

export const INITIAL_RACK_PROJECTIONS: RoomRackItemDto[] = [
  {
    unit: {
      id: "u-101",
      unitNumber: "A-101",
      buildingName: { th: "อาคาร A", en: "Building A" },
      floorNumber: 1,
      unitTypeName: { th: "สตูดิโอ ดีลักซ์ (28 ตร.ม.)", en: "Studio Deluxe (28 sqm)" },
    },
    occupancyStatus: "Vacant",
    conditionStatus: "Clean",
    supportedStayModes: ["Hourly", "Daily"],
    activeStayMode: null,
    activeDocumentNumber: null,
    customer: undefined,
    remainingMinutes: null,
  },
  {
    unit: {
      id: "u-201",
      unitNumber: "A-201",
      buildingName: { th: "อาคาร A", en: "Building A" },
      floorNumber: 2,
      unitTypeName: { th: "1 ห้องนอน สแตนดาร์ด (32 ตร.ม.)", en: "Standard 1-Bed (32 sqm)" },
    },
    occupancyStatus: "Occupied",
    conditionStatus: "Clean",
    supportedStayModes: ["Hourly", "Daily", "Monthly"],
    activeStayMode: "Hourly",
    activeDocumentNumber: "BKK01-STY-2611-0021",
    customer: {
      id: "c-001",
      fullName: "Somchai Prasert",
      maskedNationalId: "1-xxxx-xxxxx-42-9",
    },
    remainingMinutes: 42,
  },
  {
    unit: {
      id: "u-301",
      unitNumber: "A-301",
      buildingName: { th: "อาคาร A", en: "Building A" },
      floorNumber: 3,
      unitTypeName: { th: "1 ห้องนอน สแตนดาร์ด (32 ตร.ม.)", en: "Standard 1-Bed (32 sqm)" },
    },
    occupancyStatus: "Occupied",
    conditionStatus: "Clean",
    supportedStayModes: ["Monthly"],
    activeStayMode: "Monthly",
    activeDocumentNumber: "BKK01-LSE-2611-0015",
    customer: {
      id: "c-002",
      fullName: "Wipaporn Kittisak",
      maskedNationalId: "3-xxxx-xxxxx-11-8",
    },
    remainingMinutes: null,
  },
  {
    unit: {
      id: "u-302",
      unitNumber: "A-302",
      buildingName: { th: "อาคาร A", en: "Building A" },
      floorNumber: 3,
      unitTypeName: { th: "1 ห้องนอน สแตนดาร์ด (32 ตร.ม.)", en: "Standard 1-Bed (32 sqm)" },
    },
    occupancyStatus: "Vacant",
    conditionStatus: "Dirty",
    supportedStayModes: ["Hourly", "Daily"],
    activeStayMode: null,
    activeDocumentNumber: null,
    customer: undefined,
    remainingMinutes: null,
  },
];
