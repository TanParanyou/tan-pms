import { CENTRAL_PROPERTIES } from "@/constants/master-data";

export interface DemoRolePreset {
  roleCode: "OrganizationAdmin" | "PropertyManager" | "FrontDeskCashier";
  username: string;
  password: string;
  labelKey: string;
  permissionsCount: number;
  propertiesCount: number;
  propertyCodes: string[];
}

export const DEMO_ROLE_PRESETS: DemoRolePreset[] = [
  {
    roleCode: "OrganizationAdmin",
    username: "admin.hq@tan-pms.internal",
    password: "••••••••••••",
    labelKey: "roleSuperAdmin",
    permissionsCount: 5,
    propertiesCount: 3,
    propertyCodes: ["BKK01", "BKK02", "CNX01"],
  },
  {
    roleCode: "PropertyManager",
    username: "manager.bkk@tan-pms.internal",
    password: "••••••••••••",
    labelKey: "rolePropertyManager",
    permissionsCount: 4,
    propertiesCount: 2,
    propertyCodes: ["BKK01", "BKK02"],
  },
  {
    roleCode: "FrontDeskCashier",
    username: "reception.bkk01@tan-pms.internal",
    password: "••••••••••••",
    labelKey: "roleFrontDesk",
    permissionsCount: 3,
    propertiesCount: 1,
    propertyCodes: ["BKK01"],
  },
];

export const DEMO_ROLE_PRESET_MAP: Record<string, DemoRolePreset> = Object.fromEntries(
  DEMO_ROLE_PRESETS.map((p) => [p.roleCode, p])
);

export const DEMO_AUTH_CREDENTIALS = {
  adminUsername: DEMO_ROLE_PRESETS[0].username,
  clientNationalId: "1-1002-39481-22-1",
  maskedPassword: "••••••••••••",
} as const;

export const AUTHORIZED_PROPERTY_CODES = CENTRAL_PROPERTIES.map((p) => p.code);
