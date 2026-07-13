import {
  fieldForcePermissionKeys,
  roleTemplates,
} from "@/lib/user-management";
import type {
  FieldForcePermissionKey,
  Role,
} from "@/lib/types";

type StoredPermissionGrant = {
  enabled: boolean;
  permission: { key: string };
};

type StoredRolePermissionGrant = StoredPermissionGrant & {
  role: Role;
};

const permissionKeySet = new Set<string>(fieldForcePermissionKeys);

export function resolveRolePermissions(
  role: Role,
  grants: StoredRolePermissionGrant[]
) {
  const permissions = { ...roleTemplates[role].permissions };
  for (const grant of grants) {
    if (grant.role !== role || !isFieldForcePermissionKey(grant.permission.key)) continue;
    permissions[grant.permission.key] = grant.enabled;
  }
  return permissions;
}

export function applyPermissionOverrides(
  defaults: Record<FieldForcePermissionKey, boolean>,
  overrides: StoredPermissionGrant[]
) {
  const permissions = { ...defaults };
  for (const override of overrides) {
    if (!isFieldForcePermissionKey(override.permission.key)) continue;
    permissions[override.permission.key] = override.enabled;
  }
  return permissions;
}

export function listPermissionOverrides(
  desired: Record<FieldForcePermissionKey, boolean>,
  defaults: Record<FieldForcePermissionKey, boolean>
) {
  return fieldForcePermissionKeys
    .filter((key) => Boolean(desired[key]) !== Boolean(defaults[key]))
    .map((key) => ({ key, enabled: Boolean(desired[key]) }));
}

export function missingPermissionKeys(keys: Iterable<string>) {
  const available = new Set(keys);
  return fieldForcePermissionKeys.filter((key) => !available.has(key));
}

function isFieldForcePermissionKey(key: string): key is FieldForcePermissionKey {
  return permissionKeySet.has(key);
}
