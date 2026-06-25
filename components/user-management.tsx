"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { canAccessUserManagement, roleLabels } from "@/lib/permissions";
import {
  createEmptyManagedUser,
  fieldForcePermissionGroups,
  fieldForcePermissionKeys,
  prepareManagedUserSave,
  roleTemplates,
  userManagementCapabilities,
  visibleManagedUsers,
} from "@/lib/user-management";
import type {
  FieldForcePermissionKey,
  ManagedUser,
  Role,
} from "@/lib/types";

const roles: Role[] = [
  "REPRESENTATIVE",
  "SALES_LEADER",
  "SERVICE_OPERATOR",
  "COUNTRY_MANAGER",
  "GROUP_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
];

type ViewMode = "list" | "create" | "edit";

export function UsersManagementPage() {
  const {
    user,
    managedUsers,
    createManagedUser,
    updateManagedUser,
  } = useSession();
  const [mode, setMode] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<ManagedUser>(() =>
    createEmptyManagedUser(user)
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const [notice, setNotice] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [saving, setSaving] = useState(false);

  const visibleUsers = useMemo(
    () => visibleManagedUsers(user, managedUsers),
    [managedUsers, user]
  );
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleUsers
      .filter((profile) => {
        if (statusFilter === "active" && !profile.active) return false;
        if (statusFilter === "inactive" && profile.active) return false;
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
  }, [query, statusFilter, visibleUsers]);

  const selectedUser = selectedId
    ? managedUsers.find((profile) => profile.id === selectedId)
    : undefined;
  const createCapabilities = userManagementCapabilities(user);

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
        const created = await createManagedUser(draft);
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

  if (mode !== "list") {
    const teamOptions = Array.from(
      new Map(
        managedUsers
          .filter((profile) => profile.teamId)
          .map((profile) => [
            profile.teamId,
            {
              id: profile.teamId,
              name: profile.teamName,
              country: profile.country,
            },
          ])
      ).values()
    );
    return (
      <UserForm
        actor={user}
        mode={mode}
        draft={draft}
        original={selectedUser}
        notice={notice}
        saving={saving}
        teamOptions={teamOptions}
        onChange={setDraft}
        onCancel={() => returnToList()}
        onSave={save}
      />
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
          <select
            className="field sm:w-48"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
            aria-label="Filter op status"
          >
            <option value="all">Alle statussen</option>
            <option value="active">Actief</option>
            <option value="inactive">Niet-actief</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(260px,1.3fr)_minmax(220px,1fr)_120px_36px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Gebruiker</span>
          <span>Rol en team</span>
          <span>Status</span>
          <span />
        </div>
        {filteredUsers.length ? (
          filteredUsers.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => openEdit(profile)}
              className="grid w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-brand-50/50 md:grid-cols-[minmax(260px,1.3fr)_minmax(220px,1fr)_120px_36px] md:items-center md:gap-4 md:px-5"
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
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                  profile.active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {profile.active ? "Actief" : "Niet-actief"}
              </span>
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
              Pas de zoekopdracht of statusfilter aan.
            </p>
          </div>
        )}
      </div>
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
  onChange,
  onCancel,
  onSave,
}: {
  actor: ReturnType<typeof useSession>["user"];
  mode: Exclude<ViewMode, "list">;
  draft: ManagedUser;
  original?: ManagedUser;
  notice?: { type: "success" | "error"; message: string };
  saving: boolean;
  teamOptions: { id: string; name: string; country: ManagedUser["country"] }[];
  onChange: (draft: ManagedUser) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const capabilities = userManagementCapabilities(actor, original);
  const canSave =
    capabilities.canEditPersonal ||
    capabilities.canEditScope ||
    capabilities.canEditRoleRights ||
    capabilities.canEditActive;
  const teamRequired = ["REPRESENTATIVE", "SALES_LEADER", "SERVICE_OPERATOR"].includes(
    draft.role
  );
  const availableRoles = roles.filter(
    (role) => actor.role === "SUPER_ADMIN" || role !== "SUPER_ADMIN"
  );
  const availableTeams = teamOptions.filter(
    (team) =>
      team.country === draft.country ||
      (actor.role !== "SUPER_ADMIN" && team.country === actor.country)
  );
  const modeLabel =
    mode === "create"
      ? "Gebruiker toevoegen"
      : canSave
        ? "Gebruiker bewerken"
        : "Gebruiker bekijken";

  function update<K extends keyof ManagedUser>(
    field: K,
    value: ManagedUser[K]
  ) {
    onChange({ ...draft, [field]: value });
  }

  function applyRole(role: Role) {
    const template = roleTemplates[role];
    onChange({
      ...draft,
      role,
      permissions: { ...template.permissions },
    });
  }

  function setAllRights(enabled: boolean) {
    onChange({
      ...draft,
      permissions: Object.fromEntries(
        fieldForcePermissionKeys.map((key) => [key, enabled])
      ) as Record<FieldForcePermissionKey, boolean>,
    });
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
                  <option value="">Geen team</option>
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
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
                  value={draft.role}
                  disabled={!capabilities.canEditRoleRights}
                  onChange={(event) => applyRole(event.target.value as Role)}
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Teamsupervisor"
                checked={draft.teamSupervisor}
                disabled={!capabilities.canEditScope}
                onChange={(checked) => update("teamSupervisor", checked)}
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
