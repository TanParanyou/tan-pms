import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type ParcelItemDto = Schemas["ParcelItemDto"];
export type ParcelListResponse = Schemas["ParcelListResponse"];
export type ReceiveParcelRequest = Schemas["ReceiveParcelRequest"];
export type PickUpParcelRequest = Schemas["PickUpParcelRequest"];
export type ParcelStatusType = "Arrived" | "PickedUp";
