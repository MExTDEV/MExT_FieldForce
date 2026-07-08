"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useModules } from "@/components/module-provider";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import {
  getConfigurableMenuDomains,
  menuPermissionKeys,
  type AppSwitcherDomain,
} from "@/lib/app-switcher";
import { canAccessUserManagement, roleLabels } from "@/lib/permissions";
import {
  createEmptyManagedUser,
  fieldForceBasePermissionKeys,
  fieldForcePermissionGroups,
  managedUserToMockUser,
  prepareManagedUserSave,
  roleTemplates,
  userManagementCapabilities,
  visibleManagedUsers,
} from "@/lib/user-management";
import { optionalTeamLeaderLabel } from "@/lib/team-management";
import type {
  Country,
  FieldForcePermissionKey,
  ManagedUser,
  ManagementConfiguration,
  ManagementTeam,
  Role,
  UserLoginSessionPage,
  UserLoginSessionRecord,
} from "@/lib/types";

const roles: Role[] = [
  "REPRESENTATIVE",
  "SALES_LEADER",
  "SALES_MANAGER",
  "SERVICE_OPERATOR",
  "COUNTRY_MANAGER",
  "GROUP_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
];

type ViewMode = "list" | "create" | "edit";
const newTeamSelectionId = "__new_team__";

export function UsersManagementPage() {
  const {
    user,
    managedUsers,
    createManagedUser,
    updateManagedUser,
    deleteManagedUser,
  } = useSession();
  const [mode, setMode] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<ManagedUser>(() =>
    createEmptyManagedUser(user)
  );
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [saving, setSaving] = useState(false);
  const [teamOptions, setTeamOptions] = useState<ManagementTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string>();
  const [managementRoles, setManagementRoles] = useState<
    ManagementConfiguration["roles"]
  >([]);
  const [rolesError, setRolesError] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser>();

  const visibleUsers = useMemo(
    () => visibleManagedUsers(user, managedUsers),
    [managedUsers, user]
  );
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleUsers
      .filter((profile) => {
        if (!normalizedQuery) return true;
        return [
          profile.firstName,
          profile.lastName,
          profile.email,
          profile.teamName,
          roleLabels[profile.role],
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(
          `${right.lastName} ${right.firstName}`,
          "nl"
        )
      );
  }, [query, visibleUsers]);
  const activeUsers = filteredUsers.filter((profile) => profile.active);
  const inactiveUsers = filteredUsers.filter((profile) => !profile.active);

  const selectedUser = selectedId
    ? managedUsers.find((profile) => profile.id === selectedId)
    : undefined;
  const createCapabilities = userManagementCapabilities(user);

  useEffect(() => {
    if (mode === "list") return;
    let cancelled = false;
    async function loadTeams() {
      setTeamsLoading(true);
      setTeamsError(undefined);
      try {
        const response = await fetch(
          `/api/management/teams?country=${encodeURIComponent(draft.country)}`,
          { cache: "no-store" }
        );
        const payload = await response.json() as {
          teams?: ManagementTeam[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Teams konden niet worden geladen.");
        }
        if (!cancelled) {
          setTeamOptions(
            (payload.teams ?? [])
              .filter((team) => team.active && team.country === draft.country)
              .sort((left, right) => left.name.localeCompare(right.name, "nl"))
          );
        }
      } catch (cause) {
        console.error("[users] Actieve teams laden mislukt.", cause);
        if (!cancelled) {
          setTeamOptions([]);
          setTeamsError(
            cause instanceof Error
              ? cause.message
              : "Teams konden niet uit MariaDB worden geladen."
          );
        }
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    }
    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, [draft.country, mode]);

  useEffect(() => {
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) return;
    let cancelled = false;
    async function loadRoles() {
      setRolesError(undefined);
      try {
        const response = await fetch("/api/management", { cache: "no-store" });
        const payload = (await response.json()) as ManagementConfiguration & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Rollen konden niet worden geladen.");
        }
        if (!cancelled) setManagementRoles(payload.roles ?? []);
      } catch (cause) {
        if (!cancelled) {
          setRolesError(
            cause instanceof Error
              ? cause.message
              : "Rollen konden niet worden geladen."
          );
        }
      }
    }
    void loadRoles();
    return () => {
      cancelled = true;
    };
  }, [user.role]);

  if (!canAccessUserManagement(user)) {
    return <EmptyState title="Geen toegang" description="Gebruikersbeheer is niet beschikbaar voor jouw FieldForce-rol." />;
  }

  function openCreate() {
    setDraft(createEmptyManagedUser(user));
    setSelectedId(undefined);
    setNotice(undefined);
    setMode("create");
  }

  function openEdit(profile: ManagedUser) {
    setDraft({
      ...profile,
      permissions: { ...profile.permissions },
    });
    setSelectedId(profile.id);
    setNotice(undefined);
    setMode("edit");
  }

  function returnToList(message?: string) {
    setMode("list");
    setSelectedId(undefined);
    if (message) setNotice({ type: "success", message });
  }

  async function save() {
    try {
      setSaving(true);
      prepareManagedUserSave(
        user,
        managedUsers,
        draft,
        mode === "edit" ? selectedUser : undefined
      );
      if (mode === "create") {
        const created = await createManagedUser(
          draft,
          draft.teamId === newTeamSelectionId ? draft.teamName : undefined
        );
        returnToList(
          `${created.firstName} ${created.lastName} is toegevoegd.`
        );
      } else if (selectedId) {
        const updated = await updateManagedUser(selectedId, draft);
        returnToList(
          `De fiche van ${updated.firstName} ${updated.lastName} is bijgewerkt.`
        );
      }
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "De gebruiker kon niet worden opgeslagen.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function permanentlyDeleteSelected(confirmation: string) {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await deleteManagedUser(deleteTarget.id, confirmation);
      const name = `${deleteTarget.firstName} ${deleteTarget.lastName}`.trim();
      setDeleteTarget(undefined);
      returnToList(`${name} en alle gekoppelde historie zijn permanent verwijderd.`);
    } catch (error) {
      setDeleteTarget(undefined);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Gebruiker kon niet permanent worden verwijderd.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (mode !== "list") {
    return (
      <>
        <UserForm
          actor={user}
          mode={mode}
          draft={draft}
          original={selectedUser}
          notice={notice}
          saving={saving}
          teamOptions={teamOptions}
          teamsLoading={teamsLoading}
          teamsError={teamsError}
          managementRoles={managementRoles}
          rolesError={rolesError}
          managedUsers={managedUsers}
          onChange={setDraft}
          onTeamCreated={(team) =>
            setTeamOptions((current) => [
              ...current.filter((item) => item.id !== team.id),
              team,
            ])
          }
          onCancel={() => returnToList()}
          onSave={save}
          onDelete={selectedUser && user.role === "SUPER_ADMIN" && selectedUser.id !== user.id
            ? () => setDeleteTarget(selectedUser)
            : undefined}
        />
        {deleteTarget && (
          <DeleteUserDialog
            user={deleteTarget}
            saving={saving}
            onCancel={() => setDeleteTarget(undefined)}
            onDelete={(confirmation) => void permanentlyDeleteSelected(confirmation)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Beheer"
        title="Gebruikers"
        description={`${visibleUsers.length} gebruikers binnen jouw toegankelijke scope.`}
        actions={
          createCapabilities.canCreate ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Toevoegen
            </button>
          ) : undefined
        }
      />

      {notice && <Notice notice={notice} />}

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              className="field pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek op naam, e-mail, team of rol"
            />
          </label>
        </div>
      </div>

      <UsersByStatus
        title="Actieve gebruikers"
        users={activeUsers}
        forceExpand={Boolean(query.trim())}
        onOpen={openEdit}
      />
      <UsersByStatus
        title="Niet-actieve gebruikers"
        users={inactiveUsers}
        forceExpand={Boolean(query.trim())}
        onOpen={openEdit}
      />
    </div>
  );
}

const countryLabels: Record<Country, string> = {
  BE: "België",
  NL: "Nederland",
  DE: "Duitsland",
};

function UsersByStatus({
  title,
  users,
  forceExpand,
  onOpen,
}: {
  title: string;
  users: ManagedUser[];
  forceExpand: boolean;
  onOpen: (profile: ManagedUser) => void;
}) {
  const countries = groupUsersByCountryAndTeam(users);
  const knownCountries = useRef(
    new Set(countries.map(({ country }) => country))
  );
  const [openCountries, setOpenCountries] = useState<Set<Country>>(
    () => new Set(countries.map(({ country }) => country))
  );
  const [openTeams, setOpenTeams] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const newCountries = countries
      .map(({ country }) => country)
      .filter((country) => !knownCountries.current.has(country));
    if (!newCountries.length) return;
    for (const country of newCountries) knownCountries.current.add(country);
    setOpenCountries((current) => new Set([...current, ...newCountries]));
  }, [countries]);

  function toggleCountry(country: Country) {
    setOpenCountries((current) => {
      const next = new Set(current);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }

  function toggleTeam(teamKey: string) {
    setOpenTeams((current) => {
      const next = new Set(current);
      if (next.has(teamKey)) next.delete(teamKey);
      else next.add(teamKey);
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">
          {users.length} {users.length === 1 ? "gebruiker" : "gebruikers"}
        </p>
      </div>
      {countries.length ? countries.map(({ country, teams }) => {
        const countryCount = teams.reduce(
          (total, team) => total + team.users.length,
          0
        );
        const countryOpen = forceExpand || openCountries.has(country);
        return (
          <section key={country} className="card overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center gap-3 bg-slate-50/70 px-4 py-4 text-left transition hover:bg-brand-50/60 sm:px-5"
              aria-expanded={countryOpen}
              onClick={() => toggleCountry(country)}
            >
              {countryOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-brand-700" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-brand-700" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-slate-900 sm:text-lg">
                  {countryLabels[country]}
                  <span className="ml-2 text-sm text-slate-400">({country})</span>
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">
                {countryCount} {countryCount === 1 ? "gebruiker" : "gebruikers"}
              </span>
            </button>
            {countryOpen && (
              <div className="space-y-3 border-t border-slate-100 p-3 sm:p-4">
                {teams.map((team) => {
                  const teamKey = `${country}:${team.name}`;
                  const teamOpen = forceExpand || openTeams.has(teamKey);
                  return (
                    <section key={team.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50 sm:px-4"
                        aria-expanded={teamOpen}
                        onClick={() => toggleTeam(teamKey)}
                      >
                        {teamOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                          {team.name}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-500">
                          {team.users.length} {team.users.length === 1 ? "gebruiker" : "gebruikers"}
                        </span>
                      </button>
                      {teamOpen && (
                        <div className="border-t border-slate-100">
                          <UsersTable users={team.users} onOpen={onOpen} />
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        );
      }) : (
        <div className="card px-5 py-10 text-center">
          <UserCog className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">Geen gebruikers gevonden</p>
          <p className="mt-1 text-sm text-slate-500">In deze groep zijn geen gebruikers gevonden.</p>
        </div>
      )}
    </section>
  );
}

function groupUsersByCountryAndTeam(users: ManagedUser[]) {
  const countries = new Map<Country, Map<string, ManagedUser[]>>();

  for (const profile of users) {
    const teams = countries.get(profile.country) ?? new Map<string, ManagedUser[]>();
    const teamName = profile.teamName?.trim() || "Geen team";
    teams.set(teamName, [...(teams.get(teamName) ?? []), profile]);
    countries.set(profile.country, teams);
  }

  return [...countries.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "nl"))
    .map(([country, teams]) => ({
      country,
      teams: [...teams.entries()]
        .sort(([left], [right]) => {
          if (left === "Geen team") return 1;
          if (right === "Geen team") return -1;
          return left.localeCompare(right, "nl");
        })
        .map(([name, teamUsers]) => ({ name, users: teamUsers })),
    }));
}

function UsersTable({
  users,
  onOpen,
}: {
  users: ManagedUser[];
  onOpen: (profile: ManagedUser) => void;
}) {
  return (
    <div className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(240px,1.3fr)_minmax(190px,1fr)_170px_36px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Gebruiker</span>
          <span>Rol en team</span>
          <span>Status en Microsoft</span>
          <span />
        </div>
        {users.length ? (
          users.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => onOpen(profile)}
              className="grid w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-brand-50/50 md:grid-cols-[minmax(240px,1.3fr)_minmax(190px,1fr)_170px_36px] md:items-center md:gap-4 md:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  initials={`${profile.firstName[0] ?? ""}${
                    profile.lastName[0] ?? ""
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {profile.firstName} {profile.lastName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {profile.email}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {roleLabels[profile.role]}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {profile.teamName || profile.country}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 md:flex-col md:items-start">
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                    profile.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {profile.active ? "Actief" : "Niet-actief"}
                </span>
                <MicrosoftStatusBadge user={profile} compact />
              </div>
              <ChevronRight className="hidden h-5 w-5 text-slate-400 md:block" />
            </button>
          ))
        ) : (
          <div className="px-5 py-12 text-center">
            <UserCog className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">
              Geen gebruikers gevonden
            </p>
            <p className="mt-1 text-sm text-slate-500">
              In deze groep zijn geen gebruikers gevonden.
            </p>
          </div>
        )}
    </div>
  );
}

function UserForm({
  actor,
  mode,
  draft,
  original,
  notice,
  saving,
  teamOptions,
  teamsLoading,
  teamsError,
  managementRoles,
  rolesError,
  managedUsers,
  onChange,
  onTeamCreated,
  onCancel,
  onSave,
  onDelete,
}: {
  actor: ReturnType<typeof useSession>["user"];
  mode: Exclude<ViewMode, "list">;
  draft: ManagedUser;
  original?: ManagedUser;
  notice?: { type: "success" | "error"; message: string };
  saving: boolean;
  teamOptions: ManagementTeam[];
  teamsLoading: boolean;
  teamsError?: string;
  managementRoles: ManagementConfiguration["roles"];
  rolesError?: string;
  managedUsers: ManagedUser[];
  onChange: (draft: ManagedUser) => void;
  onTeamCreated: (team: ManagementTeam) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const { modules } = useModules();
  const [showTeamCreator, setShowTeamCreator] = useState(false);
  const capabilities = userManagementCapabilities(actor, original);
  const canSave =
    capabilities.canEditPersonal ||
    capabilities.canEditScope ||
    capabilities.canEditRoleRights ||
    capabilities.canEditActive;
  const teamRequired = ["REPRESENTATIVE", "SALES_LEADER", "SERVICE_OPERATOR"].includes(
    draft.role
  );
  const roleActiveByRole = useMemo(
    () =>
      Object.fromEntries(
        managementRoles.map((role) => [role.role, role.active])
      ) as Partial<Record<Role, boolean>>,
    [managementRoles]
  );
  const isRoleActive = (role: Role) => roleActiveByRole[role] ?? true;
  const availableRoles = roles.filter(
    (role) =>
      (actor.role === "SUPER_ADMIN" || role !== "SUPER_ADMIN") &&
      (isRoleActive(role) || (mode === "edit" && original?.role === role))
  );
  const selectedRoleAvailable = availableRoles.includes(draft.role);
  const selectedRoleInactive = roleActiveByRole[draft.role] === false;
  const availableTeams = teamOptions
    .filter((team) => team.active && team.country === draft.country)
    .sort((left, right) => left.name.localeCompare(right.name, "nl"));
  const modeLabel =
    mode === "create"
      ? "Gebruiker toevoegen"
      : canSave
        ? "Gebruiker bewerken"
        : "Gebruiker bekijken";
  const configurableMenuDomains = useMemo(
    () => getConfigurableMenuDomains(managedUserToMockUser(draft), modules),
    [draft, modules]
  );

  function update<K extends keyof ManagedUser>(
    field: K,
    value: ManagedUser[K]
  ) {
    onChange({ ...draft, [field]: value });
  }

  function applyRole(role: Role) {
    const template = roleTemplates[role];
    const countryAccess = role === "SALES_MANAGER"
      ? (draft.countryAccess.length ? draft.countryAccess : [draft.country])
      : [draft.country];
    onChange({
      ...draft,
      role,
      countryAccess,
      ...(draft.teamId === newTeamSelectionId && role !== "SALES_LEADER" && !draft.teamSupervisor
        ? { teamId: "", teamName: "" }
        : {}),
      permissions: { ...template.permissions },
    });
  }

  function setAllRights(enabled: boolean) {
    const permissions = { ...draft.permissions };
    for (const key of fieldForceBasePermissionKeys) permissions[key] = enabled;
    onChange({ ...draft, permissions });
  }

  function setAllMenuRights(enabled: boolean) {
    const permissions = { ...draft.permissions };
    for (const key of menuPermissionKeys) permissions[key] = false;
    if (enabled) {
      for (const domain of configurableMenuDomains) {
        if (!domain.available) continue;
        permissions[domain.enabledPermission] = true;
        for (const link of domain.links) {
          if (link.available) permissions[link.permission] = true;
        }
      }
    }
    onChange({ ...draft, permissions });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            <ArrowLeft className="h-4 w-4" /> Terug naar gebruikers
          </button>
          <p className="eyebrow">{modeLabel}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
            {mode === "create"
              ? "Nieuwe gebruiker"
              : `${draft.firstName} ${draft.lastName}`}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {canSave
              ? "Beheer profiel, scope, rol en toegangsrechten."
              : "Deze fiche is alleen-lezen binnen jouw huidige rol."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onDelete && (
            <button type="button" className="btn-secondary text-rose-700" onClick={onDelete} disabled={saving}>
              <X className="h-4 w-4" /> Permanent verwijderen
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Annuleren
          </button>
          {canSave && (
            <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Opslaan..." : "Opslaan"}
            </button>
          )}
        </div>
      </div>

      {notice && <Notice notice={notice} />}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-100 text-xl font-bold text-brand-800">
            {draft.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              `${draft.firstName[0] ?? ""}${draft.lastName[0] ?? ""}` || "NU"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Rol
            </p>
            <p className="mt-1 text-xl font-bold text-brand-800">
              {roleLabels[draft.role]}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {draft.teamName || draft.country} ·{" "}
              {draft.active ? "Actief" : "Niet-actief"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              mode === "create"
                ? "bg-blue-50 text-blue-700"
                : canSave
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-200 text-slate-600"
            }`}
          >
            {mode === "create" ? "CREATE" : canSave ? "EDIT" : "DETAIL"}
          </span>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <FormSection title="Persoonlijke gegevens">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Voornaam" required>
                <input
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.firstName}
                  disabled={!capabilities.canEditPersonal}
                  onChange={(event) => update("firstName", event.target.value)}
                />
              </Field>
              <Field label="Naam" required>
                <input
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.lastName}
                  disabled={!capabilities.canEditPersonal}
                  onChange={(event) => update("lastName", event.target.value)}
                />
              </Field>
              <Field label="E-mail" required>
                <input
                  type="email"
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.email}
                  disabled={!capabilities.canEditPersonal}
                  onChange={(event) => update("email", event.target.value)}
                />
              </Field>
              <Field label="Mobiel">
                <input
                  type="tel"
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.mobile}
                  disabled={!capabilities.canEditPersonal}
                  onChange={(event) => update("mobile", event.target.value)}
                />
              </Field>
              <Field label="Taal" required>
                <select
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.language}
                  disabled={!capabilities.canEditPersonal}
                  onChange={(event) =>
                    update(
                      "language",
                      event.target.value as ManagedUser["language"]
                    )
                  }
                >
                  <option value="nl">Nederlands</option>
                  <option value="fr">Frans</option>
                  <option value="de">Duits</option>
                </select>
              </Field>
              <Field label="Foto / avatar URL">
                <input
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.avatarUrl}
                  disabled={!capabilities.canEditPersonal}
                  placeholder="https://..."
                  onChange={(event) => update("avatarUrl", event.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Microsoft-account
                </p>
                <MicrosoftStatusBadge user={draft} />
              </div>
              {draft.microsoftLinked ? (
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-400">Microsoft e-mail</dt>
                    <dd className="mt-0.5 truncate font-semibold text-slate-700">
                      {draft.microsoftEmail || draft.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Entra ID</dt>
                    <dd className="mt-0.5 truncate font-mono text-[11px] text-slate-600" title={draft.entraId}>
                      {draft.entraId || "Niet beschikbaar"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Deze gebruiker heeft nog geen gekoppelde Microsoft-identiteit.
                </p>
              )}
              {draft.lastLoginAt && (
                <p className="mt-2 text-xs text-slate-500">
                  Laatste login: <span className="font-semibold text-slate-700">{formatLoginDate(draft.lastLoginAt)}</span>
                </p>
              )}
            </div>
          </FormSection>

          <FormSection title="Organisatie en status">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Land" required>
                <select
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.country}
                  disabled={
                    !capabilities.canEditScope || actor.role === "ADMIN"
                  }
                  onChange={(event) => {
                    const country = event.target
                      .value as ManagedUser["country"];
                    onChange({
                      ...draft,
                      country,
                      countryAccess: draft.role === "SALES_MANAGER" ? draft.countryAccess : [country],
                      teamId: "",
                      teamName: "",
                    });
                  }}
                >
                  <option value="BE">België</option>
                  <option value="NL">Nederland</option>
                  <option value="DE">Duitsland</option>
                </select>
              </Field>
              <Field label="Team">
                <select
                  className={`field disabled:bg-slate-100 disabled:text-slate-500 ${
                    teamRequired && !draft.teamId
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                      : ""
                  }`}
                  value={draft.teamId}
                  disabled={!capabilities.canEditScope}
                  onChange={(event) => {
                    const teamId = event.target.value;
                    onChange({
                      ...draft,
                      teamId,
                      teamName: teamOptions.find((team) => team.id === teamId)?.name ?? "",
                    });
                  }}
                >
                  <option value="">
                    {teamsLoading ? "Teams laden..." : "Geen team"}
                  </option>
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                  {draft.teamId === newTeamSelectionId && (
                    <option value={newTeamSelectionId}>{draft.teamName} (nieuw)</option>
                  )}
                </select>
                {mode === "create" && capabilities.canEditScope && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-900"
                    onClick={() => setShowTeamCreator(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Nieuw team aanmaken
                  </button>
                )}
                {teamsError && (
                  <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                    {teamsError}
                  </span>
                )}
                {teamRequired && !draft.teamId && (
                  <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                    Selecteer een team voor deze rol.
                  </span>
                )}
              </Field>
              <Field label="Vestigingsnummer">
                <input
                  className="field disabled:bg-slate-100 disabled:text-slate-500"
                  value={draft.branchNumber}
                  disabled={!capabilities.canEditScope}
                  onChange={(event) =>
                    update("branchNumber", event.target.value)
                  }
                />
              </Field>
              <Field label="Rol" required>
                <select
                  className="field font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                  value={selectedRoleAvailable ? draft.role : ""}
                  disabled={!capabilities.canEditRoleRights}
                  onChange={(event) => applyRole(event.target.value as Role)}
                >
                  {!selectedRoleAvailable && (
                    <option value="" disabled>
                      Selecteer een actieve rol
                    </option>
                  )}
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                      {isRoleActive(role) ? "" : " (inactief)"}
                    </option>
                  ))}
                </select>
                {selectedRoleInactive && (
                  <span className="mt-1.5 block text-xs font-semibold text-amber-700">
                    Deze gebruiker heeft een inactieve rol. Je kunt andere velden veilig bewaren, maar deze rol kan niet nieuw worden toegewezen.
                  </span>
                )}
                {rolesError && capabilities.canEditRoleRights && (
                  <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                    {rolesError}
                  </span>
                )}
              </Field>
              {draft.role === "SALES_MANAGER" && (
                <div className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Landrechten
                  </span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(Object.keys(countryLabels) as Country[]).map((country) => (
                      <Toggle
                        key={country}
                        label={`${countryLabels[country]} (${country})`}
                        checked={draft.countryAccess.includes(country)}
                        disabled={!capabilities.canEditScope}
                        onChange={(checked) => {
                          const countryAccess = checked
                            ? [...new Set([...draft.countryAccess, country])]
                            : draft.countryAccess.filter((item) => item !== country);
                          onChange({ ...draft, countryAccess });
                        }}
                      />
                    ))}
                  </div>
                  {!draft.countryAccess.length && (
                    <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                      Selecteer minstens één landrecht voor Sales Manager.
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Teamsupervisor"
                checked={draft.teamSupervisor}
                disabled={!capabilities.canEditScope}
                onChange={(checked) =>
                  onChange({
                    ...draft,
                    teamSupervisor: checked,
                    ...(draft.teamId === newTeamSelectionId &&
                    !checked &&
                    draft.role !== "SALES_LEADER"
                      ? { teamId: "", teamName: "" }
                      : {}),
                  })
                }
              />
              <Toggle
                label="Gebruiker actief"
                checked={draft.active}
                disabled={!capabilities.canEditActive}
                onChange={(checked) => update("active", checked)}
              />
            </div>
          </FormSection>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-700" />
              <h2 className="font-bold text-slate-900">Rechten</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              De rol vult een FieldForce-basisprofiel in. Elke instelling kan
              daarna per gebruiker worden overschreven.
            </p>
          </div>
          {actor.role === "SUPER_ADMIN" &&
            capabilities.canEditRoleRights && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => setAllRights(true)}
                >
                  Alles aanzetten
                </button>
                <button
                  type="button"
                  className="btn-secondary min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => setAllRights(false)}
                >
                  Alles uitzetten
                </button>
              </div>
            )}
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-2">
          <MenuRightsSection
            domains={configurableMenuDomains}
            permissions={draft.permissions}
            disabled={!capabilities.canEditRoleRights}
            onChange={(key, enabled) =>
              update("permissions", {
                ...draft.permissions,
                [key]: enabled,
              })
            }
            onEnableAll={() => setAllMenuRights(true)}
            onDisableAll={() => setAllMenuRights(false)}
          />
          {fieldForcePermissionGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-800">
                {group.title}
              </h3>
              <p className="mb-4 mt-1 text-xs leading-5 text-slate-500">
                {group.description}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.permissions.map(({ key, label }) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={draft.permissions[key]}
                    disabled={!capabilities.canEditRoleRights}
                    onChange={(checked) =>
                      update("permissions", {
                        ...draft.permissions,
                        [key]: checked,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {mode === "edit" && original && (
        <LoginSessions actorId={actor.id} userId={original.id} />
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Annuleren
        </button>
        {canSave && (
          <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Opslaan..." : "Opslaan"}
          </button>
        )}
      </div>

      {showTeamCreator && (
        <TeamCreationDialog
          actorId={actor.id}
          country={draft.country}
          newUserCanLeadTeam={
            draft.teamSupervisor || draft.role === "SALES_LEADER"
          }
          leaders={managedUsers.filter(
            (profile) =>
              profile.active &&
              profile.country === draft.country &&
              profile.role !== "REPRESENTATIVE"
          )}
          onCancel={() => setShowTeamCreator(false)}
          onUseNewUser={(name) => {
            onChange({
              ...draft,
              teamId: newTeamSelectionId,
              teamName: name,
            });
            setShowTeamCreator(false);
          }}
          onCreated={(team) => {
            onTeamCreated(team);
            onChange({
              ...draft,
              teamId: team.id,
              teamName: team.name,
            });
            setShowTeamCreator(false);
          }}
        />
      )}
    </div>
  );
}

function MenuRightsSection({
  domains,
  permissions,
  disabled,
  onChange,
  onEnableAll,
  onDisableAll,
}: {
  domains: AppSwitcherDomain[];
  permissions: Record<FieldForcePermissionKey, boolean>;
  disabled: boolean;
  onChange: (key: FieldForcePermissionKey, enabled: boolean) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}) {
  return (
    <section className="rounded-2xl border border-brand-100 bg-brand-50/30 p-4 xl:col-span-2">
      <div className="flex flex-col justify-between gap-3 border-b border-brand-100 pb-4 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-800">
            Menu-rechten
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Bepaalt welke applicaties en directe links zichtbaar zijn in het mega-menu voor deze gebruiker.
          </p>
        </div>
        {!disabled && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary min-h-9 px-3 py-1.5 text-xs"
              onClick={onEnableAll}
            >
              Alle menu-items aanzetten
            </button>
            <button
              type="button"
              className="btn-secondary min-h-9 px-3 py-1.5 text-xs"
              onClick={onDisableAll}
            >
              Alle menu-items uitzetten
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {domains.map((domain) => {
          const DomainIcon = domain.icon;
          const parentEnabled = Boolean(permissions[domain.enabledPermission]);
          const parentDisabled = disabled || !domain.available;
          return (
            <article
              key={domain.key}
              className={`rounded-xl border bg-white p-4 ${
                domain.available ? "border-slate-200" : "border-slate-100 opacity-70"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${parentEnabled && domain.available ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <DomainIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{domain.title}</p>
                  <p className="truncate text-xs text-slate-500">{domain.subtitle}</p>
                  {!domain.available && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-700">
                      Niet beschikbaar voor deze rol of moduleconfiguratie
                    </p>
                  )}
                </div>
                <CompactToggle
                  label={`${domain.title} in mega-menu`}
                  checked={parentEnabled}
                  disabled={parentDisabled}
                  onChange={(enabled) => onChange(domain.enabledPermission, enabled)}
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {domain.links.map((link) => {
                  const LinkIcon = link.icon;
                  const linkDisabled = disabled || !domain.available || !parentEnabled || !link.available;
                  return (
                    <label
                      key={link.permission}
                      className={`flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-2 ${
                        linkDisabled
                          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                          : "cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-brand-200"
                      }`}
                      title={!link.available ? "Functioneel niet beschikbaar" : undefined}
                    >
                      <LinkIcon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{link.label}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-200"
                        checked={Boolean(permissions[link.permission])}
                        disabled={linkDisabled}
                        onChange={(event) => onChange(link.permission, event.target.checked)}
                      />
                    </label>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CompactToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} title={label}>
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={`relative block h-6 w-11 rounded-full transition ${checked ? "bg-brand-700" : "bg-slate-300"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

function MicrosoftStatusBadge({
  user,
  compact = false,
}: {
  user: ManagedUser;
  compact?: boolean;
}) {
  const linked = Boolean(user.microsoftLinked || user.entraId);
  const Icon = linked ? CheckCircle2 : X;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full font-bold ${
        compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-xs"
      } ${linked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
      title={linked ? user.microsoftEmail || user.entraId : "Geen Microsoft-account gekoppeld"}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {linked ? "Microsoft gekoppeld" : "Niet gekoppeld"}
    </span>
  );
}

function LoginSessions({ actorId, userId }: { actorId: string; userId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [provider, setProvider] = useState("");
  const [browser, setBrowser] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [device, setDevice] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UserLoginSessionPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    async function loadSessions() {
      try {
        setLoading(true);
        setError(undefined);
        const parameters = new URLSearchParams({
          actorId,
          page: String(page),
        });
        if (from) parameters.set("from", from);
        if (to) parameters.set("to", to);
        if (provider) parameters.set("provider", provider);
        if (browser) parameters.set("browser", browser);
        if (ipAddress) parameters.set("ip", ipAddress);
        if (device) parameters.set("device", device);
        if (sessionStatus) parameters.set("status", sessionStatus);
        const response = await fetch(
          `/api/users/${encodeURIComponent(userId)}/login-sessions?${parameters}`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload = await response.json() as UserLoginSessionPage & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Login-sessies konden niet worden geladen.");
        setData(payload);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Login-sessies konden niet worden geladen.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadSessions();
    return () => controller.abort();
  }, [actorId, browser, device, from, ipAddress, page, provider, sessionStatus, to, userId]);

  const sessions = data?.sessions ?? [];
  const pagination = data?.pagination;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-700" />
          <h2 className="font-bold text-slate-900">Login-sessies</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Succesvolle aanmeldingen, met de nieuwste login bovenaan.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Van datum">
            <input
              type="date"
              className="field"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Tot datum">
            <input
              type="date"
              className="field"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Provider">
            <select className="field" value={provider} onChange={(event) => { setProvider(event.target.value); setPage(1); }}>
              <option value="">Alle providers</option>
              <option value="microsoft">Microsoft</option>
              <option value="credentials">Wachtwoord</option>
            </select>
          </Field>
          <Field label="Browser">
            <select className="field" value={browser} onChange={(event) => { setBrowser(event.target.value); setPage(1); }}>
              <option value="">Alle browsers</option>
              {["Edge", "Chrome", "Firefox", "Safari", "Other"].map((value) => <option key={value} value={value}>{value === "Other" ? "Andere" : value}</option>)}
            </select>
          </Field>
          <Field label="IP-adres">
            <input className="field" value={ipAddress} placeholder="Zoek op IP-adres" onChange={(event) => { setIpAddress(event.target.value); setPage(1); }} />
          </Field>
          <Field label="Device">
            <select className="field" value={device} onChange={(event) => { setDevice(event.target.value); setPage(1); }}>
              <option value="">Alle devices</option>
              <option value="Desktop">Desktop</option>
              <option value="Mobile">Mobiel</option>
              <option value="Tablet">Tablet</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="field" value={sessionStatus} onChange={(event) => { setSessionStatus(event.target.value); setPage(1); }}>
              <option value="">Alle statussen</option>
              <option value="active">Actief</option>
              <option value="logged-out">Afgemeld</option>
              <option value="expired">Verlopen</option>
            </select>
          </Field>
          {(from || to || provider || browser || ipAddress || device || sessionStatus) && (
            <button
              type="button"
              className="btn-secondary min-h-10 self-end px-3 py-2 text-xs"
              onClick={() => {
                setFrom("");
                setTo("");
                setProvider("");
                setBrowser("");
                setIpAddress("");
                setDevice("");
                setSessionStatus("");
                setPage(1);
              }}
            >
              Filters wissen
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" /> Login-sessies laden...
        </div>
      ) : error ? (
        <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Nog geen login-sessies geregistreerd.</p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[155px_105px_minmax(180px,1fr)_140px_minmax(210px,1fr)] gap-3 border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 lg:grid">
            <span>Datum en uur</span>
            <span>Provider</span>
            <span>Browser / device</span>
            <span>IP-adres</span>
            <span>Sessie</span>
          </div>
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <LoginSessionRow key={session.id} session={session} />
            ))}
          </div>
          {pagination && (
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>{pagination.total} {pagination.total === 1 ? "login" : "logins"} · pagina {pagination.page} van {pagination.totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary min-h-8 px-3 py-1 text-xs"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Vorige
                </button>
                <button
                  type="button"
                  className="btn-secondary min-h-8 px-3 py-1 text-xs"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Volgende
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LoginSessionRow({ session }: { session: UserLoginSessionRecord }) {
  const status = session.status === "active"
    ? { label: "Actief", className: "bg-emerald-50 text-emerald-700" }
    : session.status === "logged-out"
      ? { label: "Afgemeld", className: "bg-slate-100 text-slate-600" }
      : { label: "Verlopen", className: "bg-amber-50 text-amber-700" };
  return (
    <div className="grid gap-2 px-4 py-4 text-sm lg:grid-cols-[155px_105px_minmax(180px,1fr)_140px_minmax(210px,1fr)] lg:items-center lg:gap-3 lg:px-5">
      <div className="font-semibold text-slate-800">{formatLoginDate(session.loginAt)}</div>
      <div>
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${session.provider === "microsoft" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
          {session.provider === "microsoft" ? "Microsoft" : session.provider === "credentials" ? "Wachtwoord" : session.provider}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-slate-600" title={session.userAgent ?? undefined}>
        <UserCog className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate">{session.browser || "Onbekend"} · {session.operatingSystem || "Onbekend"} · {session.deviceType || "Onbekend"}</span>
      </div>
      <div className="font-mono text-xs text-slate-600">{session.ipAddress || "Niet beschikbaar"}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
          <span className="text-xs text-slate-500">{formatDuration(session.durationSeconds)}</span>
        </div>
        <div className="mt-1 truncate text-xs text-slate-500" title={session.sessionId}>
          {session.email || "Geen e-mail"} · {session.sessionId}
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} u ${minutes} min`;
}

function formatLoginDate(value: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels",
  }).format(new Date(value));
}

function TeamCreationDialog({
  actorId,
  country,
  newUserCanLeadTeam,
  leaders,
  onCancel,
  onUseNewUser,
  onCreated,
}: {
  actorId: string;
  country: Country;
  newUserCanLeadTeam: boolean;
  leaders: ManagedUser[];
  onCancel: () => void;
  onUseNewUser: (name: string) => void;
  onCreated: (team: ManagementTeam) => void;
}) {
  const newUserLeaderId = "__new_user__";
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState(
    newUserCanLeadTeam ? newUserLeaderId : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function createTeam() {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    if (leaderId === newUserLeaderId) {
      onUseNewUser(normalizedName);
      return;
    }

    try {
      setSaving(true);
      setError(undefined);
      const response = await fetch("/api/management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId,
          entity: "team",
          name: normalizedName,
          country,
          primaryLeaderId: leaderId || null,
        }),
      });
      const payload = (await response.json()) as {
        result?: {
          id: string;
          name: string;
          country: Country;
          primaryLeaderId: string | null;
          active: boolean;
        };
        error?: string;
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Het team kon niet worden aangemaakt.");
      }
      const leader = leaders.find((profile) => profile.id === leaderId);
      onCreated({
        ...payload.result,
        primaryLeaderName: optionalTeamLeaderLabel(
          leader ? `${leader.firstName} ${leader.lastName}`.trim() : null
        ),
        memberCount: 0,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Het team kon niet worden aangemaakt."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !saving && onCancel()
      }
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-team-title"
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
      >
        <h2 id="new-team-title" className="text-lg font-bold text-slate-950">
          Nieuw team aanmaken
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Het team wordt aangemaakt voor {country} en meteen geselecteerd.
        </p>
        <div className="mt-5 space-y-4">
          <Field label="Teamnaam" required>
            <input
              className="field"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Verkoopleider">
            <select
              className="field"
              value={leaderId}
              onChange={(event) => setLeaderId(event.target.value)}
            >
              <option value="">Geen verkoopleider toegewezen</option>
              {newUserCanLeadTeam && (
                <option value={newUserLeaderId}>
                  Deze nieuwe gebruiker
                </option>
              )}
              {leaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.firstName} {leader.lastName} ({roleLabels[leader.role]})
                </option>
              ))}
            </select>
          </Field>
          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Annuleren
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!name.trim() || saving}
            onClick={() => void createTeam()}
          >
            <Plus className="h-4 w-4" /> {saving ? "Aanmaken..." : "Team aanmaken"}
          </button>
        </div>
      </section>
    </div>
  );
}

function DeleteUserDialog({
  user,
  saving,
  onCancel,
  onDelete,
}: {
  user: ManagedUser;
  saving: boolean;
  onCancel: () => void;
  onDelete: (confirmation: string) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const matches = confirmation.trim().toLowerCase() === user.email.trim().toLowerCase();
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onCancel()}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="delete-user-title" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
        <h2 id="delete-user-title" className="text-lg font-bold text-slate-950">Gebruiker permanent verwijderen</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          <strong>{user.firstName} {user.lastName}</strong> en alle gekoppelde historie worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.
        </p>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Typ <strong className="normal-case text-slate-800">{user.email}</strong> ter bevestiging
          </span>
          <input className="field" autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Annuleren</button>
          <button
            type="button"
            className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!matches || saving}
            onClick={() => onDelete(confirmation)}
          >
            {saving ? "Verwijderen..." : "Permanent verwijderen"}
          </button>
        </div>
      </section>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-brand-800">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
        disabled
          ? "cursor-not-allowed border-slate-100 bg-slate-100/80 text-slate-400"
          : "cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-brand-200"
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-brand-700" : "bg-slate-300"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </label>
  );
}

function Notice({
  notice,
}: {
  notice: { type: "success" | "error"; message: string };
}) {
  const success = notice.type === "success";
  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {success ? (
        <CheckCircle2 className="h-5 w-5 shrink-0" />
      ) : (
        <X className="h-5 w-5 shrink-0" />
      )}
      {notice.message}
    </div>
  );
}
