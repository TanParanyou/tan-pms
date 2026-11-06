import type { LocalizedTextDto } from "@/lib/i18n/localized-text";
import { WORK_ORDER_CATEGORIES } from "@/constants/master-data";

export const CLIENT_SAMPLE_PROFILE = {
  maskedNationalId: "3-xxxx-xxxxx-11-8",
  initialRemainingSeconds: 14 * 60 + 59,
} as const;

export const SAMPLE_HOLD_RESERVATION = {
  documentNumber: "BKK01-RES-2611-0108",
  unitTypeName: { th: "1 ห้องนอน สแตนดาร์ด (32 ตร.ม.)", en: "Standard 1-Bed (32 sqm)" } as LocalizedTextDto,
  stayMode: "Daily",
  depositAmount: "1,500.00",
};

export const SAMPLE_LEASE_DETAILS = {
  leaseNumber: "BKK01-LSE-2611-0015",
  formattedRent: "12,500.00",
  formattedDeposit: "25,000.00",
  unit: {
    id: "u-301",
    unitNumber: "A-301",
    buildingName: { th: "อาคาร A", en: "Building A" } as LocalizedTextDto,
    floorNumber: 3,
    unitTypeName: { th: "1 ห้องนอน สแตนดาร์ด (32 ตร.ม.)", en: "Standard 1-Bed (32 sqm)" } as LocalizedTextDto,
  },
};

export const SAMPLE_INVOICE_DETAILS = {
  invoiceNumber: "BKK01-INV-2611-0042",
  formattedTotal: "15,350.00",
  formattedRentAmount: "12,500.00",
  formattedServiceAmount: "1,000.00",
  formattedUtilityAmount: "1,850.00",
} as const;

export const SAMPLE_PARCEL_DETAILS = {
  parcelNumber: "BKK01-PCL-2611-0042",
} as const;

export const MAINTENANCE_CATEGORIES = WORK_ORDER_CATEGORIES;
