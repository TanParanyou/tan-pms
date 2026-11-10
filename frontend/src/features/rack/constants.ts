import type { RoomRackItemDto, PropertyRefDto } from "./types";
import { CENTRAL_PROPERTIES, DEFAULT_KEY_DEPOSIT } from "@/constants/master-data";

export { DEFAULT_KEY_DEPOSIT };
export const ADMIN_PROPERTIES: PropertyRefDto[] = [...CENTRAL_PROPERTIES];
