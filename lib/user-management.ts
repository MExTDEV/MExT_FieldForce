import type {
  FieldForcePermissionKey,
  ManagedUser,
  MockUser,
  Role,
} from "@/lib/types";
import { menuPermissionKeys } from "@/lib/app-switcher";

export const fieldForcePermissionGroups: {
  title: string;
  description: string;
  permissions: { key: FieldForcePermissionKey; label: string }[];
}[] = [
  {
    title: "Hoofdmodules",
    description: "Toegang tot de belangrijkste werkruimtes van FieldForce.",
    permissions: [
      { key: "moduleDashboard", label: "Dashboard" },
      { key: "moduleAgenda", label: "Agenda" },
      { key: "modulePreparation", label: "Voorbereiding" },
      { key: "moduleVisitRecord", label: "Bezoekfiche" },
      { key: "moduleMyTeam", label: "Mijn Team" },
      { key: "moduleReporting", label: "Rapportering" },
      { key: "modulePdfExport", label: "Export PDF" },
      { key: "moduleUserManagement", label: "Gebruikersbeheer" },
      { key: "moduleTechnicalManagement", label: "Technisch Beheer" },
    ],
  },
  {
    title: "Prestatiebeheer",
    description: "Bekijken, vergelijken en beheren van prestatiegegevens.",
    permissions: [
      { key: "performanceView", label: "Prestatiecirkel bekijken" },
      {
        key: "performanceCompare",
        label: "Prestatiecirkel vergelijken met vorige periode",
      },
      { key: "performanceScoresView", label: "Scores/tabel bekijken" },
      { key: "performanceScoresExport", label: "Scores exporteren" },
      {
        key: "performanceScoresManage",
        label: "Scores beheren / corrigeren",
      },
    ],
  },
  {
    title: "Gebruikersbeheer",
    description: "Acties die binnen de toegelaten gebruikersscope mogelijk zijn.",
    permissions: [
      { key: "usersView", label: "Gebruikers bekijken" },
      { key: "usersCreate", label: "Gebruikers toevoegen" },
      { key: "usersEdit", label: "Gebruikers wijzigen" },
      { key: "usersDeactivate", label: "Gebruikers deactiveren" },
      { key: "usersRolesEdit", label: "Rollen wijzigen" },
      { key: "usersPermissionsEdit", label: "Rechten wijzigen" },
    ],
  },
  {
    title: "Rapportering",
    description: "Bereik en exportmogelijkheden voor FieldForce-rapporten.",
    permissions: [
      { key: "reportingOwn", label: "Eigen rapportering bekijken" },
      { key: "reportingTeam", label: "Teamrapportering bekijken" },
      { key: "reportingAll", label: "Alle rapportering bekijken" },
      { key: "reportingExport", label: "Rapportering exporteren" },
    ],
  },
  {
    title: "Technisch beheer",
    description: "Configuratie van gegevens, parameters en app-instellingen.",
    permissions: [
      { key: "technicalTables", label: "Tabellen beheren" },
      { key: "technicalParameters", label: "Parameters beheren" },
      { key: "technicalBranding", label: "Design/branding beheren" },
      { key: "technicalImportExport", label: "Import/export beheren" },
    ],
  },
];

export const fieldForceBasePermissionKeys = fieldForcePermissionGroups.flatMap(
  (group) => group.permissions.map((permission) => permission.key)
);

export const fieldForcePermissionKeys = [
  ...fieldForceBasePermissionKeys,
  ...menuPermissionKeys,
];

const emptyPermissions = (): Record<FieldForcePermissionKey, boolean> =>
  Object.fromEntries(
    fieldForcePermissionKeys.map((key) => [key, false])
  ) as Record<FieldForcePermissionKey, boolean>;

function permissions(
  ...enabled: FieldForcePermissionKey[]
): Record<FieldForcePermissionKey, boolean> {
  const result = emptyPermissions();
  for (const key of enabled) result[key] = true;
  return result;
}

const allPermissions = () =>
  permissions(...fieldForcePermissionKeys);

const representativeMenuPermissions: FieldForcePermissionKey[] = [
  "menu.coaching.enabled",
  "menu.coaching.dashboard",
  "menu.coaching.planning",
  "menu.coaching.coachings",
  "menu.coaching.actionPoints",
];

const serviceOperatorMenuPermissions: FieldForcePermissionKey[] = [
  ...representativeMenuPermissions,
  "menu.service.enabled",
  "menu.service.myDay",
  "menu.service.planning",
  "menu.service.interventions",
];

const internalMenuPermissions: FieldForcePermissionKey[] = [
  "menu.coaching.enabled",
  "menu.coaching.dashboard",
  "menu.coaching.planning",
  "menu.coaching.coachings",
  "menu.coaching.myTeam",
  "menu.coaching.actionPoints",
  "menu.coaching.reporting",
  "menu.coaching.users",
  "menu.salesday.enabled",
  "menu.salesday.preparation",
  "menu.salesday.agenda",
  "menu.salesday.team",
  "menu.salesday.stock",
  "menu.pst.enabled",
  "menu.pst.dashboard",
  "menu.pst.planning",
  "menu.pst.segments",
  "menu.pst.routes",
  "menu.pst.prospecting",
  "menu.contract.enabled",
  "menu.contract.open",
  "menu.service.enabled",
  "menu.service.myDay",
  "menu.service.planning",
  "menu.service.interventions",
];

export const roleTemplates: Record<Role, Pick<ManagedUser, "permissions">> = {
  REPRESENTATIVE: {
    permissions: permissions(
      "moduleDashboard",
      "moduleAgenda",
      "modulePreparation",
      "moduleVisitRecord",
      "performanceView",
      "performanceCompare",
      "performanceScoresView",
      "reportingOwn",
      ...representativeMenuPermissions
    ),
  },
  SALES_LEADER: {
    permissions: permissions(
      "moduleDashboard",
      "moduleAgenda",
      "modulePreparation",
      "moduleVisitRecord",
      "moduleMyTeam",
      "moduleReporting",
      "modulePdfExport",
      "performanceView",
      "performanceCompare",
      "performanceScoresView",
      "performanceScoresExport",
      "usersView",
      "reportingOwn",
      "reportingTeam",
      "reportingExport",
      ...internalMenuPermissions
    ),
  },
  SALES_MANAGER: {
    permissions: permissions(
      "moduleDashboard",
      "moduleAgenda",
      "modulePreparation",
      "moduleVisitRecord",
      "moduleMyTeam",
      "moduleReporting",
      "modulePdfExport",
      "performanceView",
      "performanceCompare",
      "performanceScoresView",
      "performanceScoresExport",
      "usersView",
      "reportingOwn",
      "reportingTeam",
      "reportingExport",
      ...internalMenuPermissions
    ),
  },
  SERVICE_OPERATOR: {
    permissions: permissions(
      "moduleDashboard",
      "moduleAgenda",
      "modulePreparation",
      "moduleVisitRecord",
      "reportingOwn",
      ...serviceOperatorMenuPermissions
    ),
  },
  COUNTRY_MANAGER: {
    permissions: permissions(
      "moduleDashboard",
      "moduleAgenda",
      "moduleMyTeam",
      "moduleReporting",
      "modulePdfExport",
      "performanceView",
      "performanceCompare",
      "performanceScoresView",
      "performanceScoresExport",
      "usersView",
      "reportingOwn",
      "reportingTeam",
      "reportingExport",
      ...internalMenuPermissions
    ),
  },
  GROUP_MANAGER: {
    permissions: permissions(
      "moduleDashboard",
      "moduleAgenda",
      "moduleMyTeam",
      "moduleReporting",
      "modulePdfExport",
      "performanceView",
      "performanceCompare",
      "performanceScoresView",
      "performanceScoresExport",
      "usersView",
      "reportingOwn",
      "reportingTeam",
      "reportingAll",
      "reportingExport",
      ...internalMenuPermissions
    ),
  },
  ADMIN: {
    permissions: permissions(
      "moduleDashboard",
      "moduleAgenda",
      "modulePreparation",
      "moduleVisitRecord",
      "moduleMyTeam",
      "moduleReporting",
      "modulePdfExport",
      "moduleUserManagement",
      "performanceView",
      "performanceCompare",
      "performanceScoresView",
      "performanceScoresExport",
      "performanceScoresManage",
      "usersView",
      "usersCreate",
      "usersEdit",
      "usersDeactivate",
      "usersRolesEdit",
      "usersPermissionsEdit",
      "reportingOwn",
      "reportingTeam",
      "reportingExport",
      ...internalMenuPermissions,
      "menu.coaching.modules",
      "menu.coaching.roles"
    ),
  },
  SUPER_ADMIN: {
    permissions: allPermissions(),
  },
};

export function createEmptyManagedUser(actor: MockUser): ManagedUser {
  const role: Role = "REPRESENTATIVE";
  return {
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    language: actor.language,
    country: actor.country,
    countryAccess: actor.role === "SALES_MANAGER" ? actor.countryAccess ?? [] : [actor.country],
    teamId: actor.teamId ?? "",
    teamName: "",
    role,
    teamSupervisor: false,
    branchNumber: "",
    active: true,
    avatarUrl: "",
    permissions: { ...roleTemplates[role].permissions },
  };
}

export function normalizeManagedUser(user: ManagedUser): ManagedUser {
  const storedPermissions = (user.permissions ?? {}) as Partial<
    Record<FieldForcePermissionKey, boolean>
  >;
  const hasFieldForcePermissions = fieldForcePermissionKeys.some(
    (key) => typeof storedPermissions[key] === "boolean"
  );
  const basePermissions = hasFieldForcePermissions
    ? emptyPermissions()
    : roleTemplates[user.role]?.permissions ?? emptyPermissions();

  return {
    ...user,
    mobile: user.mobile ?? "",
    countryAccess: user.countryAccess?.length ? user.countryAccess : [user.country],
    teamId: user.teamId ?? "",
    teamName: user.teamName ?? "",
    teamSupervisor: Boolean(user.teamSupervisor),
    branchNumber: user.branchNumber ?? "",
    active: user.active !== false,
    avatarUrl: user.avatarUrl ?? "",
    permissions: Object.fromEntries(
      fieldForcePermissionKeys.map((key) => [
        key,
        hasFieldForcePermissions
          ? Boolean(storedPermissions[key])
          : Boolean(basePermissions[key]),
      ])
    ) as Record<FieldForcePermissionKey, boolean>,
  };
}

export function managedUserToMockUser(profile: ManagedUser): MockUser {
  return {
    id: profile.id,
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    email: profile.email,
    role: profile.role,
    country: profile.country,
    countryAccess: profile.countryAccess,
    language: profile.language,
    teamId: profile.teamId || undefined,
    representativeId: profile.representativeId,
    permissions: profile.permissions,
  };
}

export type UserManagementCapabilities = {
  canView: boolean;
  canCreate: boolean;
  canEditPersonal: boolean;
  canEditScope: boolean;
  canEditRoleRights: boolean;
  canEditActive: boolean;
};

export function isOwnProfile(actor: MockUser, target: ManagedUser) {
  return (
    actor.id === target.id ||
    actor.email.toLowerCase() === target.email.toLowerCase() ||
    Boolean(
      actor.representativeId &&
        actor.representativeId === target.representativeId
    )
  );
}

export function userManagementCapabilities(
  actor: MockUser,
  target?: ManagedUser
): UserManagementCapabilities {
  const isCreate = !target;
  if (actor.role === "SUPER_ADMIN") {
    return {
      canView: true,
      canCreate: true,
      canEditPersonal: true,
      canEditScope: true,
      canEditRoleRights: true,
      canEditActive: true,
    };
  }
  if (actor.role === "ADMIN") {
    const editable =
      isCreate ||
      (target?.country === actor.country && target.role !== "SUPER_ADMIN");
    return {
      canView: isCreate ? true : target?.country === actor.country,
      canCreate: true,
      canEditPersonal: Boolean(editable),
      canEditScope: Boolean(editable),
      canEditRoleRights: Boolean(editable),
      canEditActive: Boolean(editable),
    };
  }
  if (actor.role === "SALES_LEADER") {
    return {
      canView: Boolean(target && actor.teamId === target.teamId),
      canCreate: false,
      canEditPersonal: false,
      canEditScope: false,
      canEditRoleRights: false,
      canEditActive: false,
    };
  }
  if (actor.role === "REPRESENTATIVE") {
    return {
      canView: false,
      canCreate: false,
      canEditPersonal: false,
      canEditScope: false,
      canEditRoleRights: false,
      canEditActive: false,
    };
  }
  if (actor.role === "SERVICE_OPERATOR") {
    const own = Boolean(target && isOwnProfile(actor, target));
    return {
      canView: own,
      canCreate: false,
      canEditPersonal: own,
      canEditScope: false,
      canEditRoleRights: false,
      canEditActive: false,
    };
  }
  if (actor.role === "SALES_MANAGER") {
    const countries = new Set(actor.countryAccess ?? []);
    return {
      canView: Boolean(target && countries.has(target.country)),
      canCreate: false,
      canEditPersonal: false,
      canEditScope: false,
      canEditRoleRights: false,
      canEditActive: false,
    };
  }
  if (actor.role === "COUNTRY_MANAGER") {
    return {
      canView: Boolean(target && target.country === actor.country),
      canCreate: false,
      canEditPersonal: false,
      canEditScope: false,
      canEditRoleRights: false,
      canEditActive: false,
    };
  }
  return {
    canView: Boolean(target),
    canCreate: false,
    canEditPersonal: false,
    canEditScope: false,
    canEditRoleRights: false,
    canEditActive: false,
  };
}

export function visibleManagedUsers(actor: MockUser, users: ManagedUser[]) {
  return users.filter(
    (target) => userManagementCapabilities(actor, target).canView
  );
}

const personalFields = [
  "firstName",
  "lastName",
  "email",
  "mobile",
  "language",
  "avatarUrl",
] as const;
const scopeFields = [
  "country",
  "teamId",
  "teamName",
  "teamSupervisor",
  "branchNumber",
] as const;

export function prepareManagedUserSave(
  actor: MockUser,
  users: ManagedUser[],
  draft: ManagedUser,
  existing?: ManagedUser
) {
  const capabilities = userManagementCapabilities(actor, existing);
  if (existing && !capabilities.canView) {
    throw new Error("Je hebt geen toegang tot deze gebruiker.");
  }
  if (!existing && !capabilities.canCreate) {
    throw new Error("Je mag geen gebruikers aanmaken.");
  }

  const next = existing
    ? normalizeManagedUser(existing)
    : createEmptyManagedUser(actor);

  if (capabilities.canEditPersonal) {
    for (const field of personalFields) next[field] = draft[field] as never;
  }
  if (capabilities.canEditScope) {
    for (const field of scopeFields) next[field] = draft[field] as never;
    next.countryAccess = draft.countryAccess?.length ? [...draft.countryAccess] : [draft.country];
  }
  if (capabilities.canEditActive) next.active = draft.active;
  if (capabilities.canEditRoleRights) {
    if (actor.role !== "SUPER_ADMIN" && draft.role === "SUPER_ADMIN") {
      throw new Error("Alleen een Super Admin kan de rol Super Admin toekennen.");
    }
    next.role = draft.role;
    next.permissions = Object.fromEntries(
      fieldForcePermissionKeys.map((key) => [
        key,
        Boolean(draft.permissions[key]),
      ])
    ) as Record<FieldForcePermissionKey, boolean>;
  }

  if (actor.role === "ADMIN") next.country = actor.country;
  if (!next.firstName.trim() || !next.lastName.trim() || !next.email.trim()) {
    throw new Error("Voornaam, naam en e-mail zijn verplicht.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email.trim())) {
    throw new Error("Vul een geldig e-mailadres in.");
  }
  if (
    users.some(
      (user) =>
        user.id !== existing?.id &&
        user.email.toLowerCase() === next.email.trim().toLowerCase()
    )
  ) {
    throw new Error("Dit e-mailadres is al in gebruik.");
  }
  if (
    ["REPRESENTATIVE", "SALES_LEADER", "SERVICE_OPERATOR"].includes(next.role) &&
    !next.teamId
  ) {
    throw new Error("Selecteer een team voor deze rol.");
  }
  if (next.role === "SALES_MANAGER" && !next.countryAccess.length) {
    throw new Error("Selecteer minstens één landrecht voor Sales Manager.");
  }

  return normalizeManagedUser({
    ...next,
    id: existing?.id ?? `user-${Date.now()}`,
    firstName: next.firstName.trim(),
    lastName: next.lastName.trim(),
    email: next.email.trim().toLowerCase(),
    mobile: next.mobile.trim(),
    branchNumber: next.branchNumber.trim(),
  });
}
