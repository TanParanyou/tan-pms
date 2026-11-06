import type {
  PropertyDetailDto,
  BuildingDetailDto,
  FloorDetailDto,
  UnitTypeDetailDto,
  UnitMasterItemDto,
  UnitAssetDto,
  UpsertUnitMasterRequest,
  UpsertUnitAssetItemDto,
  BuildingRefDto,
  FloorRefDto,
  UnitTypeRefDto,
  LocalizedTextDto,
} from "@/generated/api";

export type {
  PropertyDetailDto,
  BuildingDetailDto,
  FloorDetailDto,
  UnitTypeDetailDto,
  UnitMasterItemDto,
  UnitAssetDto,
  UpsertUnitMasterRequest,
  UpsertUnitAssetItemDto,
  BuildingRefDto,
  FloorRefDto,
  UnitTypeRefDto,
  LocalizedTextDto,
};

export interface UnitMasterFormData {
  id?: string;
  unitNumber: string;
  buildingId: string;
  floorId: string;
  unitTypeId: string;
  conditionStatus: "Clean" | "Dirty" | "Cleaning" | "Inspecting" | "OutOfOrder";
  supportedStayModes: ("Hourly" | "Daily" | "Monthly")[];
  assets: UpsertUnitAssetItemDto[];
}
