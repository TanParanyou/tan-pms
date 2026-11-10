export const PERMISSION_PROPERTIES_MANAGE = "admin.properties.manage";

export const UNIT_STAY_MODES = ["Hourly", "Daily", "Monthly"] as const;
export const UNIT_CONDITION_OPTIONS = ["Clean", "Dirty", "Cleaning", "Inspecting", "OutOfOrder"] as const;
export const UNIT_OCCUPANCY_OPTIONS = ["Vacant", "Occupied", "Reserved", "Blocked"] as const;

export const UNIT_FORM_DEFAULTS = {
  unitNumber: "",
  buildingId: "",
  floorId: "",
  unitTypeId: "",
  supportedStayModes: ["Hourly", "Daily"] as ("Hourly" | "Daily" | "Monthly")[],
  conditionStatus: "Clean" as (typeof UNIT_CONDITION_OPTIONS)[number],
  assets: [] as { assetCode: string; nameTh: string; nameEn: string; replacementCostAmount: number }[],
};
export const EMPTY_ASSET = { assetCode: "", nameTh: "", nameEn: "", replacementCostAmount: 0 };
export const BUILDING_FORM_DEFAULTS = { code: "", nameTh: "", nameEn: "" };
export const FLOOR_FORM_DEFAULTS = { buildingId: "", floorNumber: 1, nameTh: "", nameEn: "" };
export const UNIT_TYPE_FORM_DEFAULTS = {
  code: "",
  nameTh: "",
  nameEn: "",
  descriptionTh: "",
  descriptionEn: "",
  areaSqm: 0,
  totalQuotaUnits: 1,
  supportedStayModes: ["Hourly", "Daily"] as ("Hourly" | "Daily" | "Monthly")[],
  hourlyBasePackagePrice: 0,
  hourlyBasePackageHours: 3,
  hourlyAdditionalHourPrice: 0,
  dailyRate: 0,
  monthlyRentRate: 0,
};
export const ALL_BUILDINGS_FILTER = "";
