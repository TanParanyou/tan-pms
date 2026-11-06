import type {
  RoomRackItemDto,
  CheckInStayRequest,
  PropertyRefDto,
  LocalizedTextDto,
} from "@/generated/api";

export type {
  RoomRackItemDto,
  CheckInStayRequest,
  PropertyRefDto,
  LocalizedTextDto,
};

export interface CheckInFormData {
  guestName: string;
  guestId: string;
  phone?: string;
  selectedUnitId: string;
  stayMode: "Hourly" | "Daily" | "Monthly";
  keyDepositAmount: string;
  overrideDirty: boolean;
  overrideReason?: string;
}
