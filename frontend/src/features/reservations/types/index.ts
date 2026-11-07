import type {
  AssignableUnitOptionDto,
  UnitTypeAvailabilityDto,
  AvailabilitySearchResponse,
  ReservationItemDto,
  ReservationListResponse,
  CreateAdminReservationRequest,
  AssignReservationUnitRequest,
  CancelReservationRequest,
  CreateClientHoldReservationRequest,
  SubmitReservationSlipRequest,
  PropertyRefDto,
  CustomerRefDto,
  UnitTypeRefDto,
  UnitRefDto,
  LocalizedTextDto,
} from "@/generated/api";

export type {
  AssignableUnitOptionDto,
  UnitTypeAvailabilityDto,
  AvailabilitySearchResponse,
  ReservationItemDto,
  ReservationListResponse,
  CreateAdminReservationRequest,
  AssignReservationUnitRequest,
  CancelReservationRequest,
  CreateClientHoldReservationRequest,
  SubmitReservationSlipRequest,
  PropertyRefDto,
  CustomerRefDto,
  UnitTypeRefDto,
  UnitRefDto,
  LocalizedTextDto,
};

export type ReservationStatusType =
  | "Hold"
  | "PendingVerification"
  | "Confirmed"
  | "CheckedIn"
  | "Expired"
  | "Cancelled"
  | "NoShow";

export type ReservationStayModeType = "Hourly" | "Daily" | "Monthly";
