export const PERMISSION_USERS_MANAGE = "admin.users.manage";
export const PERMISSION_USERS_DEACTIVATE = "admin.users.deactivate";
export const PERMISSION_USERS_REACTIVATE = "admin.users.reactivate";
export const ALL_ROLES_FILTER = "All";
export const USER_STATUS_FILTERS = ["All", "Active", "Inactive"] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];
export const USER_FORM_DEFAULTS = {
  username: "",
  fullName: "",
  email: "",
  roleCode: "",
  allowedPropertyIds: [] as string[],
  isActive: true,
  initialPassword: "",
};
