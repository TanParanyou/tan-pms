import type { RoleDefinitionDto, AdminUserDto, PropertyRefDto } from "./types";
import { CENTRAL_PROPERTIES } from "@/constants/master-data";

// Helper to convert readonly PropertyMasterItem to mutable PropertyRefDto
const PROP_BKK01: PropertyRefDto = {
  id: CENTRAL_PROPERTIES[0].id,
  code: CENTRAL_PROPERTIES[0].code,
  name: { ...CENTRAL_PROPERTIES[0].name },
};

const PROP_BKK02: PropertyRefDto = {
  id: CENTRAL_PROPERTIES[1].id,
  code: CENTRAL_PROPERTIES[1].code,
  name: { ...CENTRAL_PROPERTIES[1].name },
};

const PROP_CNX01: PropertyRefDto = {
  id: CENTRAL_PROPERTIES[2].id,
  code: CENTRAL_PROPERTIES[2].code,
  name: { ...CENTRAL_PROPERTIES[2].name },
};

export const ROLE_CATALOG_PROJECTION: RoleDefinitionDto[] = [
  {
    code: "OrganizationAdmin",
    name: {
      th: "ผู้ดูแลระบบสูงสุด (Super Admin)",
      en: "Organization Administrator",
    },
    scope: "AdminScope",
    defaultPermissions: [
      "admin.users.manage",
      "admin.roles.view",
      "admin.properties.all",
      "admin.financial.all",
      "admin.operations.all",
    ],
  },
  {
    code: "PropertyManager",
    name: {
      th: "ผู้จัดการสาขา",
      en: "Property Manager",
    },
    scope: "AdminScope",
    defaultPermissions: [
      "admin.users.view",
      "admin.properties.scoped",
      "admin.financial.approve",
      "admin.operations.all",
    ],
  },
  {
    code: "FrontDeskCashier",
    name: {
      th: "พนักงานต้อนรับและแคชเชียร์",
      en: "Front Desk Cashier",
    },
    scope: "AdminScope",
    defaultPermissions: [
      "admin.stays.checkin",
      "admin.cashier.shift",
      "admin.billing.collect",
    ],
  },
  {
    code: "PropertyAccountant",
    name: {
      th: "นักบัญชีประจำสาขา",
      en: "Property Accountant",
    },
    scope: "AdminScope",
    defaultPermissions: [
      "admin.invoices.view",
      "admin.receipts.issue",
      "admin.financial.audit",
    ],
  },
  {
    code: "Housekeeper",
    name: {
      th: "พนักงานแม่บ้าน",
      en: "Housekeeper",
    },
    scope: "AdminScope",
    defaultPermissions: [
      "admin.rooms.clean",
      "admin.rooms.inspect",
    ],
  },
  {
    code: "MaintenanceTechnician",
    name: {
      th: "ช่างซ่อมบำรุง",
      en: "Maintenance Technician",
    },
    scope: "AdminScope",
    defaultPermissions: [
      "admin.workorders.update",
      "admin.meters.read",
    ],
  },
];

export const INITIAL_ADMIN_USERS: AdminUserDto[] = [
  {
    id: "usr-admin-01",
    username: "admin.hq@tan-pms.internal",
    fullName: "Kittipong Vongsuwan",
    email: "kittipong.v@tan-pms.com",
    roleCode: "OrganizationAdmin",
    roleName: {
      th: "ผู้ดูแลระบบสูงสุด (Super Admin)",
      en: "Organization Administrator",
    },
    isActive: true,
    allowedProperties: [PROP_BKK01, PROP_BKK02, PROP_CNX01],
    permissions: [
      "admin.users.manage",
      "admin.roles.view",
      "admin.properties.all",
      "admin.financial.all",
      "admin.operations.all",
    ],
  },
  {
    id: "usr-mgr-01",
    username: "manager.bkk@tan-pms.internal",
    fullName: "Nattaporn Chaiyarat",
    email: "nattaporn.c@tan-pms.com",
    roleCode: "PropertyManager",
    roleName: {
      th: "ผู้จัดการสาขา",
      en: "Property Manager",
    },
    isActive: true,
    allowedProperties: [PROP_BKK01, PROP_BKK02],
    permissions: [
      "admin.users.view",
      "admin.properties.scoped",
      "admin.financial.approve",
      "admin.operations.all",
    ],
  },
  {
    id: "usr-front-01",
    username: "reception.bkk01@tan-pms.internal",
    fullName: "Siriporn Thanakorn",
    email: "siriporn.t@tan-pms.com",
    roleCode: "FrontDeskCashier",
    roleName: {
      th: "พนักงานต้อนรับและแคชเชียร์",
      en: "Front Desk Cashier",
    },
    isActive: true,
    allowedProperties: [PROP_BKK01],
    permissions: [
      "admin.stays.checkin",
      "admin.cashier.shift",
      "admin.billing.collect",
    ],
  },
  {
    id: "usr-front-02",
    username: "reception.cnx01@tan-pms.internal",
    fullName: "Anan Sukprasert",
    email: "anan.s@tan-pms.com",
    roleCode: "FrontDeskCashier",
    roleName: {
      th: "พนักงานต้อนรับและแคชเชียร์",
      en: "Front Desk Cashier",
    },
    isActive: false,
    allowedProperties: [PROP_CNX01],
    permissions: [
      "admin.stays.checkin",
      "admin.cashier.shift",
      "admin.billing.collect",
    ],
  },
];

export const INITIAL_ROLE_CATALOG = ROLE_CATALOG_PROJECTION;
export const ROLE_CATALOG_MAP = Object.fromEntries(
  ROLE_CATALOG_PROJECTION.map((r) => [r.code, r])
);
export const ADMIN_USER_MAP = Object.fromEntries(
  INITIAL_ADMIN_USERS.map((u) => [u.id, u])
);
