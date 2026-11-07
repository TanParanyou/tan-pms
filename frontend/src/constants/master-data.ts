import type { LocalizedTextDto } from "@/lib/i18n/localized-text";

export interface PropertyMasterItem {
  id: string;
  code: string;
  name: LocalizedTextDto;
}

export const CENTRAL_PROPERTIES: readonly PropertyMasterItem[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    code: "BKK01",
    name: {
      th: "\u0e41\u0e17\u0e19 \u0e40\u0e23\u0e2a\u0e0b\u0e34\u0e40\u0e14\u0e19\u0e0b\u0e4c \u0e1e\u0e23\u0e30\u0e23\u0e32\u0e21 9",
      en: "TAN Residence Rama 9",
    },
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    code: "BKK02",
    name: {
      th: "\u0e41\u0e17\u0e19 \u0e2a\u0e27\u0e35\u0e17 \u0e2a\u0e38\u0e02\u0e38\u0e21\u0e27\u0e34\u0e17",
      en: "TAN Suites Sukhumvit",
    },
  },
  {
    id: "22222222-2222-2222-2222-222222222202",
    code: "CNX01",
    name: {
      th: "\u0e41\u0e17\u0e19 \u0e41\u0e01\u0e23\u0e19\u0e14\u0e4c \u0e19\u0e34\u0e21\u0e21\u0e32\u0e19",
      en: "TAN Grand Nimman",
    },
  },
] as const;

export const STAY_MODES = ["Hourly", "Daily", "Monthly"] as const;
export type StayModeType = (typeof STAY_MODES)[number];

export const DOCUMENT_PREFIXES = {
  RESERVATION: "RES",
  STAY: "STY",
  LEASE: "LSE",
  INVOICE: "INV",
  RECEIPT: "RCT",
  DEPOSIT: "DEP",
  SHIFT: "SHF",
  WORK_ORDER: "WKO",
  PARCEL: "PCL",
} as const;

export const DEFAULT_KEY_DEPOSIT = "500.00";

export const HOLD_PAYMENT_CONFIG = {
  bankName: "SCB",
  accountNumber: "402-984711-2",
  accountName: "TAN Residence Co., Ltd.",
  holdTtlMinutes: 15,
} as const;

export const WORK_ORDER_CATEGORIES = [
  "Air Conditioning",
  "Plumbing & Water",
  "Electrical",
  "Furniture & Door",
] as const;
