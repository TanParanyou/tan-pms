import type {
  AdminUserDto,
  RoleDefinitionDto,
  PermissionDefinitionDto,
  UpsertAdminUserRequest,
  PropertyRefDto,
  LocalizedTextDto,
} from "@/generated/api";

export type {
  AdminUserDto,
  RoleDefinitionDto,
  PermissionDefinitionDto,
  UpsertAdminUserRequest,
  PropertyRefDto,
  LocalizedTextDto,
};

export interface UserFormData {
  id?: string;
  username: string;
  fullName: string;
  email: string;
  roleCode: string;
  allowedPropertyIds: string[];
  isActive: boolean;
}
