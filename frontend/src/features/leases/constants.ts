import type { BadgeProps } from "@/components/ui/badge";
import type { LeaseStatusType } from "./types";

export const LEASE_STATUS_OPTIONS: readonly LeaseStatusType[] = [
  "Active",
  "MoveOutNotice",
  "MovedOut",
  "Draft",
  "PendingSignature",
  "Terminated",
  "Cancelled",
];

export const LEASE_STATUS_BADGE_VARIANT: Record<LeaseStatusType, NonNullable<BadgeProps["variant"]>> = {
  Draft: "secondary",
  PendingSignature: "warning",
  Active: "success",
  MoveOutNotice: "warning",
  MovedOut: "outline",
  Terminated: "destructive",
  Cancelled: "destructive",
};

export const PLATE_SEARCH_DEBOUNCE_MS = 400;

export const LEASE_CREATE_TAB_IDS = {
  terms: "tab-lease-terms",
  meters: "tab-lease-meters",
  people: "tab-lease-people",
} as const;

export const LEASE_CREATE_DEFAULTS = {
  unitId: "",
  customerId: "",
  startDate: "",
  endDate: "",
  monthlyRentAmount: 0,
  securityDepositAmount: 0,
  initialWaterMeterReading: 0,
  initialElectricMeterReading: 0,
  occupants: [],
  vehicles: [],
};

export const EMPTY_OCCUPANT = {
  fullName: "",
  nationalityCode: "THA",
  identityNumber: "",
  isPrimaryOccupant: false,
};

export const EMPTY_VEHICLE = { licensePlate: "", province: "", vehicleBrandModel: "" };

export const LEASE_FIELD_TO_TAB: Record<string, string> = {
  unitId: LEASE_CREATE_TAB_IDS.terms,
  customerId: LEASE_CREATE_TAB_IDS.terms,
  startDate: LEASE_CREATE_TAB_IDS.terms,
  endDate: LEASE_CREATE_TAB_IDS.terms,
  monthlyRentAmount: LEASE_CREATE_TAB_IDS.terms,
  securityDepositAmount: LEASE_CREATE_TAB_IDS.terms,
  initialWaterMeterReading: LEASE_CREATE_TAB_IDS.meters,
  initialElectricMeterReading: LEASE_CREATE_TAB_IDS.meters,
  occupants: LEASE_CREATE_TAB_IDS.people,
  vehicles: LEASE_CREATE_TAB_IDS.people,
};

export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;
