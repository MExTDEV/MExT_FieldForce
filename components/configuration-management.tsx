"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { ManagementImportExportPanel } from "@/components/management-import-export-panel";
import { EmptyState, PageHeader } from "@/components/ui";
import { fieldForcePermissionGroups } from "@/lib/user-management";
import {
  kpiEvaluationLabels,
  kpiPeriodTypeLabels,
  kpiTargetScopeLabels,
  kpiUnitOptions,
} from "@/lib/kpi-settings";
import { optionalTeamLeaderLabel } from "@/lib/team-management";
import type { ManagementImportExportTopic } from "@/lib/management-import-export";
import type {
  Country,
  FieldForcePermissionKey,
  KpiEvaluationDirection,
  KpiPeriodType,
  KpiTargetScope,
  KpiUnit,
  ManagementConfiguration,
  Role,
} from "@/lib/types";

type Section = "teams" | "rollen" | "kpis" | "kapstok";
type Mutation = (
  method: "POST" | "PATCH" | "DELETE",
  payload: Record<string, unknown>
) => Promise<boolean>;
type EditorState =
  | { kind: "team"; id?: string; name: string; country: Country; primaryLeaderId: string }
  | {
      kind: "kpi";
      id?: string;
      code: string;
      name: string;
      description: string;
      categoryId: string;
      typeId: string;
      targetTypeId: string;
      country: Country | null;
      teamId: string;
      userId: string;
      targetRole: Role | "";
      unit: KpiUnit;
      targetValue: string;
      minValue: string;
      maxValue: string;
      weight: string;
      countsForReporting: boolean;
      countsForPerformanceCircle: boolean;
      sortOrder: number;
      validFrom: string;
      validUntil: string;
      evaluationDirection: KpiEvaluationDirection;
      active: boolean;
    }
  | {
      kind: "kpiTarget";
      id?: string;
      kpiDefinitionId: string;
      targetTypeId: string;
      scope: KpiTargetScope;
      country: Country | null;
      teamId: string;
      userId: string;
      role: Role | "";
      periodType: KpiPeriodType;
      periodStart: string;
      periodEnd: string;
      targetValue: string;
      active: boolean;
    }
  | { kind: "focus"; id?: string; code: string; name: string; sortOrder: number }
  | { kind: "criterion"; id?: string; focusId: string; name: string; sortOrder: number }
  | { kind: "deactivate"; entity: string; id: string; name: string }
  | { kind: "purge"; entity: string; id: string; name: string };

export function ConfigurationManagement({ section }: { section: Section }) {
  const { user, managedUsers } = useSession();
  const [data, setData] = useState<ManagementConfiguration>();
  const [error, setError] = useState<string>();
  const [editor, setEditor] = useState<EditorState>();
  const [kpiFilters, setKpiFilters] = useState({
    query: "",
    categoryId: "",
    typeId: "",
    active: "active",
    scope: "",
  });

  async function refresh() {
    const response = await fetch("/api/management", { cache: "no-store" });
    const payload = await response.json() as ManagementConfiguration & {
      details?: string;
      error?: string;
      requestId?: string;
    };
    if (!response.ok) {
      const requestLabel = payload.requestId ? ` (${payload.requestId})` : "";
      throw new Error(
        `${payload.details ?? payload.error ?? "Beheer kon niet worden geladen."}${requestLabel}`
      );
    }
    setData(payload);
  }

  useEffect(() => {
    refresh().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Beheer kon niet worden geladen.")
    );
  }, []);

  const mutate: Mutation = async (method, payload) => {
    setError(undefined);
    const response = await fetch("/api/management", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, actorId: user.id }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Wijziging kon niet worden opgeslagen.");
      return false;
    }
    await refresh();
    return true;
  };

  async function saveEditor() {
    if (!editor) return;
    let saved = false;
    if (editor.kind === "deactivate") {
      saved = await mutate("DELETE", { entity: editor.entity, id: editor.id });
    } else if (editor.kind === "purge") {
      saved = await mutate("DELETE", {
        entity: editor.entity,
        id: editor.id,
        permanent: true,
        confirmation: editor.name,
      });
    } else {
      const { kind, id, ...values } = editor;
      saved = await mutate(id ? "PATCH" : "POST", {
        entity: kind,
        ...(id ? { id } : {}),
        ...values,
      });
    }
    if (saved) setEditor(undefined);
  }

  if (!data && !error) {
    return <EmptyState title="Beheer laden" description="Configuratie wordt uit MariaDB opgehaald." />;
  }
  if (!data) {
    return <EmptyState title="Beheer niet beschikbaar" description={error ?? "Onbekende fout."} />;
  }

  const titles = {
    teams: "Teams",
    rollen: "Rollen en rechten",
    kpis: "KPI-definities",
    kapstok: "Kapstok beheer",
  };
  const canCreateKpis = hasPermission(user, "kpisCreate");
  const filteredKpis = filterKpis(data, kpiFilters);
  const showAddButton = section !== "rollen" && (section !== "kpis" || canCreateKpis);
  const importExportTopic = importExportTopicForSection(section);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuratie"
        title={titles[section]}
        description={user.role === "SUPER_ADMIN" ? "Beheer voor alle landen." : `Beheer voor ${user.country}.`}
        actions={showAddButton ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setEditor(newEditor(section, user.country, data))}
          >
            <Plus className="h-4 w-4" /> Toevoegen
          </button>
        ) : undefined}
      />

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {importExportTopic && (
        <ManagementImportExportPanel
          topic={importExportTopic}
          onCommitted={refresh}
        />
      )}

      {section === "teams" && (
        <>
          <StatusGroup title="Actieve teams" count={data.teams.filter((item) => item.active).length}>
            <Grid>
          {data.teams.filter((item) => item.active).map((item) => (
            <Card
              key={item.id}
              title={item.name}
              detail={`${item.country} | ${optionalTeamLeaderLabel(item.primaryLeaderName)} | ${item.memberCount} leden`}
              active={item.active}
              onEdit={() => setEditor({
                kind: "team",
                id: item.id,
                name: item.name,
                country: item.country,
                primaryLeaderId: item.primaryLeaderId ?? "",
              })}
              onDelete={() => setEditor({
                kind: "deactivate",
                entity: "team",
                id: item.id,
                name: item.name,
              })}
              onPermanentDelete={user.role === "SUPER_ADMIN" ? () => setEditor({
                kind: "purge",
                entity: "team",
                id: item.id,
                name: item.name,
              }) : undefined}
            />
          ))}
            </Grid>
          </StatusGroup>
          <StatusGroup title="Niet-actieve teams" count={data.teams.filter((item) => !item.active).length}>
            <Grid>
          {data.teams.filter((item) => !item.active).map((item) => (
            <Card
              key={item.id}
              title={item.name}
              detail={`${item.country} | ${optionalTeamLeaderLabel(item.primaryLeaderName)} | ${item.memberCount} leden`}
              active={item.active}
              onEdit={() => setEditor({
                kind: "team",
                id: item.id,
                name: item.name,
                country: item.country,
                primaryLeaderId: item.primaryLeaderId ?? "",
              })}
              onDelete={() => setEditor({
                kind: "deactivate",
                entity: "team",
                id: item.id,
                name: item.name,
              })}
              onPermanentDelete={user.role === "SUPER_ADMIN" ? () => setEditor({
                kind: "purge",
                entity: "team",
                id: item.id,
                name: item.name,
              }) : undefined}
            />
          ))}
            </Grid>
          </StatusGroup>
        </>
      )}

      {section === "kpis" && (
        <>
          <KpiFilterBar
            data={data}
            filters={kpiFilters}
            onChange={setKpiFilters}
          />
          <StatusGroup title="Actieve KPI's" count={filteredKpis.filter((item) => item.active).length}>
            <Grid>
          {filteredKpis.filter((item) => item.active).map((item) => (
            <Card
              key={item.id}
              title={item.name}
              detail={kpiCardDetail(data, item)}
              active={item.active}
              onEdit={() => setEditor(kpiEditorFromItem(item))}
              onExtra={() => setEditor(kpiTargetEditorFromKpi(data, item))}
              extraLabel="Doelwaarde toevoegen"
              onDelete={() => setEditor({
                kind: "deactivate",
                entity: "kpi",
                id: item.id,
                name: item.name,
              })}
              onPermanentDelete={user.role === "SUPER_ADMIN" ? () => setEditor({
                kind: "purge",
                entity: "kpi",
                id: item.id,
                name: item.name,
              }) : undefined}
            />
          ))}
            </Grid>
          </StatusGroup>
          <StatusGroup title="Niet-actieve KPI's" count={filteredKpis.filter((item) => !item.active).length}>
            <Grid>
          {filteredKpis.filter((item) => !item.active).map((item) => (
            <Card
              key={item.id}
              title={item.name}
              detail={kpiCardDetail(data, item)}
              active={item.active}
              onEdit={() => setEditor(kpiEditorFromItem(item))}
              onExtra={() => setEditor(kpiTargetEditorFromKpi(data, item))}
              extraLabel="Doelwaarde toevoegen"
              onDelete={() => setEditor({
                kind: "deactivate",
                entity: "kpi",
                id: item.id,
                name: item.name,
              })}
              onPermanentDelete={user.role === "SUPER_ADMIN" ? () => setEditor({
                kind: "purge",
                entity: "kpi",
                id: item.id,
                name: item.name,
              }) : undefined}
            />
          ))}
            </Grid>
          </StatusGroup>
        </>
      )}

      {section === "kapstok" && (
        <>
          <StatusGroup title="Actieve kapstokken" count={data.focuses.filter((focus) => focus.active).length}>
            <div className="space-y-4">
              {data.focuses.filter((focus) => focus.active).map((focus) => (
                <FocusCard key={focus.id} focus={focus} isSuperAdmin={user.role === "SUPER_ADMIN"} onEdit={setEditor} />
              ))}
            </div>
          </StatusGroup>
          <StatusGroup title="Niet-actieve kapstokken" count={data.focuses.filter((focus) => !focus.active).length}>
            <div className="space-y-4">
              {data.focuses.filter((focus) => !focus.active).map((focus) => (
                <FocusCard key={focus.id} focus={focus} isSuperAdmin={user.role === "SUPER_ADMIN"} onEdit={setEditor} />
              ))}
            </div>
          </StatusGroup>
        </>
      )}

      {section === "rollen" && (
        <>
          <StatusGroup title="Actieve rollen" count={data.roles.filter((role) => role.active).length} description="Rollen die beschikbaar zijn voor nieuwe toewijzingen.">
            <div className="space-y-4">
              {data.roles.filter((role) => role.active).map((role) => (
                <RolePermissions key={role.role} role={role} canManage={user.role === "SUPER_ADMIN"} mutate={mutate} />
              ))}
            </div>
          </StatusGroup>
          <StatusGroup title="Inactieve rollen" count={data.roles.filter((role) => !role.active).length} description="Rollen blijven zichtbaar, maar kunnen niet nieuw worden toegewezen.">
            <div className="space-y-4">
              {data.roles.filter((role) => !role.active).map((role) => (
                <RolePermissions key={role.role} role={role} canManage={user.role === "SUPER_ADMIN"} mutate={mutate} />
              ))}
            </div>
          </StatusGroup>
        </>
      )}

      {editor && (
        <ManagementEditor
          editor={editor}
          data={data}
          users={managedUsers}
          canChooseCountry={user.role === "SUPER_ADMIN"}
          onChange={setEditor}
          onCancel={() => setEditor(undefined)}
          onSave={() => void saveEditor()}
        />
      )}
    </div>
  );
}

function StatusGroup({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">
          {description ?? `${count} ${count === 1 ? "item" : "items"}`}
        </p>
      </div>
      {count > 0 ? children : (
        <div className="card px-5 py-10 text-center text-sm font-semibold text-slate-500">
          Geen items in deze groep.
        </div>
      )}
    </section>
  );
}

function FocusCard({
  focus,
  isSuperAdmin,
  onEdit,
}: {
  focus: ManagementConfiguration["focuses"][number];
  isSuperAdmin: boolean;
  onEdit: (editor: EditorState) => void;
}) {
  const activeCriteria = focus.criteria.filter((criterion) => criterion.active);
  const inactiveCriteria = focus.criteria.filter((criterion) => !criterion.active);

  function criterionRows(
    criteria: typeof focus.criteria,
    title: string
  ) {
    return (
      <div>
        <div className="border-y border-slate-100 bg-slate-50 px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          {title} ({criteria.length})
        </div>
        {criteria.length ? criteria.map((criterion) => (
          <div key={criterion.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0">
            <span className="w-8 text-sm font-bold text-slate-400">{criterion.sortOrder}</span>
            <span className="flex-1 text-sm font-semibold">{criterion.name}</span>
            <Action
              label="Bewerken"
              onClick={() => onEdit({
                kind: "criterion",
                id: criterion.id,
                focusId: focus.id,
                name: criterion.name,
                sortOrder: criterion.sortOrder,
              })}
            >
              <MoreHorizontal />
            </Action>
            {isSuperAdmin && (
              <Action
                label="Definitief verwijderen"
                danger
                onClick={() => onEdit({
                  kind: "purge",
                  entity: "criterion",
                  id: criterion.id,
                  name: criterion.name,
                })}
              >
                <Trash2 />
              </Action>
            )}
            {criterion.active && (
              <Action
                label="Deactiveren"
                danger
                onClick={() => onEdit({
                  kind: "deactivate",
                  entity: "criterion",
                  id: criterion.id,
                  name: criterion.name,
                })}
              >
                <X />
              </Action>
            )}
          </div>
        )) : (
          <p className="px-5 py-4 text-sm text-slate-500">Geen criteria in deze groep.</p>
        )}
      </div>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-5">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold">{focus.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${focus.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {focus.active ? "Actief" : "Niet-actief"}
            </span>
          </div>
          <p className="text-sm text-slate-500">{focus.code} | volgorde {focus.sortOrder}</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onEdit({
            kind: "criterion",
            focusId: focus.id,
            name: "",
            sortOrder: focus.criteria.length + 1,
          })}
        >
          <Plus className="h-4 w-4" /> Criterium
        </button>
        <Action
          label="Bewerken"
          onClick={() => onEdit({
            kind: "focus",
            id: focus.id,
            code: focus.code,
            name: focus.name,
            sortOrder: focus.sortOrder,
          })}
        >
          <MoreHorizontal />
        </Action>
        {isSuperAdmin && (
          <Action
            label="Definitief verwijderen"
            danger
            onClick={() => onEdit({
              kind: "purge",
              entity: "focus",
              id: focus.id,
              name: focus.name,
            })}
          >
            <Trash2 />
          </Action>
        )}
        {focus.active && (
          <Action
            label="Deactiveren"
            danger
            onClick={() => onEdit({
              kind: "deactivate",
              entity: "focus",
              id: focus.id,
              name: focus.name,
            })}
          >
            <X />
          </Action>
        )}
      </div>
      {criterionRows(activeCriteria, "Actieve criteria")}
      {criterionRows(inactiveCriteria, "Niet-actieve criteria")}
    </section>
  );
}

function RolePermissions({
  role,
  canManage,
  mutate,
}: {
  role: ManagementConfiguration["roles"][number];
  canManage: boolean;
  mutate: Mutation;
}) {
  const [permissions, setPermissions] = useState(role.permissions);
  const [active, setActive] = useState(role.active);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setPermissions(role.permissions);
    setActive(role.active);
  }, [role.role, role.permissions, role.active]);

  const hasChanges =
    active !== role.active ||
    Object.entries(role.permissions).some(
      ([key, value]) =>
        permissions[key as keyof typeof permissions] !== value
    );
  const userCountLabel = `${role.userCount} ${
    role.userCount === 1 ? "gebruiker" : "gebruikers"
  }`;

  async function save() {
    const saved = await mutate("PATCH", {
      entity: "role",
      role: role.role,
      active,
      permissions,
    });
    if (saved) setExpanded(false);
  }

  return (
    <section className={`card overflow-hidden transition ${active ? "" : "bg-slate-50/70 opacity-85"}`}>
      <div className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${expanded ? "border-b" : ""}`}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-950">{role.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                {active ? "Actief" : "Inactief"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                Vaste systeemrol
              </span>
              {hasChanges && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                  Niet opgeslagen
                </span>
              )}
            </span>
            <span className="mt-1 block text-sm text-slate-500">{userCountLabel}</span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-bold ${
              active
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600"
            } disabled:cursor-not-allowed disabled:opacity-60`}
            disabled={!canManage}
            onClick={() => setActive((current) => !current)}
            title={canManage ? "Rol activeren of deactiveren" : "Alleen Super Admin kan rollen activeren of deactiveren"}
          >
            {active ? "Actief" : "Inactief"}
          </button>
          {hasChanges && canManage && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void save()}
            >
              <Check className="h-4 w-4" /> Opslaan
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? "Verbergen" : "Bekijken"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {fieldForcePermissionGroups.map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-2 font-bold">{group.title}</legend>
              {group.permissions.map((permission) => (
                <label key={permission.key} className="mb-2 flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={permissions[permission.key]}
                    disabled={!canManage}
                    onChange={(event) => setPermissions({
                      ...permissions,
                      [permission.key]: event.target.checked,
                    })}
                  />
                  {permission.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Card({
  title,
  detail,
  active,
  onEdit,
  onExtra,
  extraLabel,
  onDelete,
  onPermanentDelete,
}: {
  title: string;
  detail: string;
  active: boolean;
  onEdit: () => void;
  onExtra?: () => void;
  extraLabel?: string;
  onDelete: () => void;
  onPermanentDelete?: () => void;
}) {
  return (
    <article className="card flex items-center gap-3 p-5">
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-bold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
        <p className={`mt-2 text-xs font-bold ${active ? "text-emerald-700" : "text-slate-400"}`}>
          {active ? "Actief" : "Inactief"}
        </p>
      </div>
      <Action label="Bewerken" onClick={onEdit}><MoreHorizontal /></Action>
      {onExtra && <Action label={extraLabel ?? "Extra actie"} onClick={onExtra}><Plus /></Action>}
      {active && <Action label="Deactiveren" danger onClick={onDelete}><X /></Action>}
      {onPermanentDelete && <Action label="Definitief verwijderen" danger onClick={onPermanentDelete}><Trash2 /></Action>}
    </article>
  );
}

function Action({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-md ${
        danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function KpiFilterBar({
  data,
  filters,
  onChange,
}: {
  data: ManagementConfiguration;
  filters: { query: string; categoryId: string; typeId: string; active: string; scope: string };
  onChange: (filters: { query: string; categoryId: string; typeId: string; active: string; scope: string }) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
      <Field label="Zoeken">
        <input
          className="field"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
      </Field>
      <Field label="Categorie">
        <select
          className="field"
          value={filters.categoryId}
          onChange={(event) => onChange({ ...filters, categoryId: event.target.value })}
        >
          <option value="">Alle categorieën</option>
          {data.kpiCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Type">
        <select
          className="field"
          value={filters.typeId}
          onChange={(event) => onChange({ ...filters, typeId: event.target.value })}
        >
          <option value="">Alle types</option>
          {data.kpiTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select
          className="field"
          value={filters.active}
          onChange={(event) => onChange({ ...filters, active: event.target.value })}
        >
          <option value="active">Actief</option>
          <option value="inactive">Inactief</option>
          <option value="all">Alles</option>
        </select>
      </Field>
      <Field label="Scope">
        <select
          className="field"
          value={filters.scope}
          onChange={(event) => onChange({ ...filters, scope: event.target.value })}
        >
          <option value="">Alle scopes</option>
          {(Object.entries(kpiTargetScopeLabels) as [KpiTargetScope, string][]).map(([scope, label]) => (
            <option key={scope} value={scope}>{label}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function KpiScopeFields({
  scope,
  country,
  teamId,
  userId,
  role,
  teams,
  users,
  canChooseCountry,
  onCountryChange,
  onTeamChange,
  onUserChange,
  onRoleChange,
}: {
  scope: KpiTargetScope;
  country: Country | null;
  teamId: string;
  userId: string;
  role: Role | "";
  teams: ManagementConfiguration["teams"];
  users: ReturnType<typeof useSession>["managedUsers"];
  canChooseCountry: boolean;
  onCountryChange: (country: Country | null) => void;
  onTeamChange: (teamId: string) => void;
  onUserChange: (userId: string) => void;
  onRoleChange: (role: Role | "") => void;
}) {
  if (scope === "GLOBAL") return null;
  const countries: Country[] = ["BE", "NL", "DE"];
  const visibleTeams = teams.filter((team) => team.active && (!country || team.country === country));
  const visibleUsers = users.filter((item) => item.active && (!country || item.country === country));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {(scope === "COUNTRY" || scope === "ROLE") && (
        <Field label="Land">
          <select
            className="field disabled:bg-slate-100 disabled:text-slate-500"
            value={country ?? ""}
            disabled={!canChooseCountry}
            onChange={(event) => onCountryChange(event.target.value ? event.target.value as Country : null)}
          >
            <option value="">Geen land</option>
            {countries.map((item) => <option key={item} value={item}>{countryLabel(item)}</option>)}
          </select>
        </Field>
      )}
      {scope === "TEAM" && (
        <Field label="Team">
          <select
            className="field"
            value={teamId}
            onChange={(event) => onTeamChange(event.target.value)}
          >
            <option value="">Selecteer team</option>
            {visibleTeams.map((team) => (
              <option key={team.id} value={team.id}>{team.name} ({team.country})</option>
            ))}
          </select>
        </Field>
      )}
      {scope === "USER" && (
        <Field label="Gebruiker">
          <select
            className="field"
            value={userId}
            onChange={(event) => onUserChange(event.target.value)}
          >
            <option value="">Selecteer gebruiker</option>
            {visibleUsers.map((item) => (
              <option key={item.id} value={item.id}>{item.firstName} {item.lastName} ({item.role})</option>
            ))}
          </select>
        </Field>
      )}
      {scope === "ROLE" && (
        <Field label="Rol">
          <select
            className="field"
            value={role}
            onChange={(event) => onRoleChange(event.target.value as Role | "")}
          >
            <option value="">Selecteer rol</option>
            {roleOptions.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
          </select>
        </Field>
      )}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function KpiTargetList({
  data,
  kpiId,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: ManagementConfiguration;
  kpiId: string;
  onAdd: () => void;
  onEdit: (target: ManagementConfiguration["kpis"][number]["targets"][number]) => void;
  onDelete: (target: ManagementConfiguration["kpis"][number]["targets"][number]) => void;
}) {
  const targets = data.kpis.find((item) => item.id === kpiId)?.targets ?? [];
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">Doelwaarden</h3>
        <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Toevoegen
        </button>
      </div>
      {targets.length ? (
        <div className="space-y-2">
          {targets.map((target) => (
            <div key={target.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${target.conflict ? "border-rose-200 bg-rose-50" : "border-slate-200"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {kpiTargetScopeLabels[target.scope]} | {formatKpiSetting(target.targetValue, data.kpis.find((item) => item.id === kpiId)?.unit ?? "number")}
                </p>
                <p className="text-xs text-slate-500">
                  {kpiPeriodTypeLabels[target.periodType]} | {target.periodStart} - {target.periodEnd} | {target.active ? "Actief" : "Inactief"}
                  {target.conflict ? " | Conflict" : ""}
                </p>
              </div>
              <Action label="Doelwaarde bewerken" onClick={() => onEdit(target)}><MoreHorizontal /></Action>
              {target.active && <Action label="Doelwaarde deactiveren" danger onClick={() => onDelete(target)}><X /></Action>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-slate-500">Nog geen periodieke doelwaarden.</p>
      )}
    </div>
  );
}

function KpiTargetEditor({
  editor,
  data,
  users,
  canChooseCountry,
  onChange,
  onCancel,
  onSave,
}: {
  editor: Extract<EditorState, { kind: "kpiTarget" }>;
  data: ManagementConfiguration;
  users: ReturnType<typeof useSession>["managedUsers"];
  canChooseCountry: boolean;
  onChange: (editor: EditorState) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const kpi = data.kpis.find((item) => item.id === editor.kpiDefinitionId);
  const valid = Boolean(
    editor.kpiDefinitionId &&
    editor.periodStart &&
    editor.periodEnd &&
    editor.targetValue.trim() &&
    Number.isFinite(Number(editor.targetValue)) &&
    kpiTargetEditorHasValidScope(editor)
  );
  return (
    <Modal title={`${editor.id ? "Bewerken" : "Toevoegen"} doelwaarde`} onCancel={onCancel}>
      <div className="space-y-4">
        <Field label="KPI">
          <select
            className="field"
            value={editor.kpiDefinitionId}
            onChange={(event) => onChange({ ...editor, kpiDefinitionId: event.target.value })}
          >
            {data.kpis.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Scope">
            <select
              className="field"
              value={editor.scope}
              onChange={(event) => {
                const scope = event.target.value as KpiTargetScope;
                onChange({
                  ...editor,
                  scope,
                  targetTypeId: data.kpiTargetTypes.find((item) => item.code === scope)?.id ?? "",
                  country: scope === "GLOBAL" ? null : editor.country,
                  teamId: "",
                  userId: "",
                  role: "",
                });
              }}
            >
              {data.kpiTargetTypes.map((targetType) => (
                <option key={targetType.id} value={targetType.code}>{targetType.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Periode">
            <select
              className="field"
              value={editor.periodType}
              onChange={(event) => onChange({ ...editor, periodType: event.target.value as KpiPeriodType })}
            >
              {(Object.entries(kpiPeriodTypeLabels) as [KpiPeriodType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
        <KpiScopeFields
          scope={editor.scope}
          country={editor.country}
          teamId={editor.teamId}
          userId={editor.userId}
          role={editor.role}
          teams={data.teams}
          users={users}
          canChooseCountry={canChooseCountry}
          onCountryChange={(country) => onChange({ ...editor, country, teamId: "", userId: "" })}
          onTeamChange={(teamId) => onChange({ ...editor, teamId })}
          onUserChange={(userId) => onChange({ ...editor, userId })}
          onRoleChange={(role) => onChange({ ...editor, role })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Start">
            <input type="date" className="field" value={editor.periodStart} onChange={(event) => onChange({ ...editor, periodStart: event.target.value })} />
          </Field>
          <Field label="Einde">
            <input type="date" className="field" value={editor.periodEnd} onChange={(event) => onChange({ ...editor, periodEnd: event.target.value })} />
          </Field>
          <Field label={`Doelwaarde${kpi ? ` (${kpi.unit})` : ""}`}>
            <input type="number" step="any" className="field" value={editor.targetValue} onChange={(event) => onChange({ ...editor, targetValue: event.target.value })} />
          </Field>
        </div>
        <CheckboxField
          label="Actief"
          checked={editor.active}
          onChange={(active) => onChange({ ...editor, active })}
        />
      </div>
      <ModalActions onCancel={onCancel} onSave={onSave} disabled={!valid} />
    </Modal>
  );
}

function newEditor(
  section: Section,
  country: Country,
  data: ManagementConfiguration
): EditorState | undefined {
  if (section === "teams") {
    return { kind: "team", name: "", country, primaryLeaderId: "" };
  }
  if (section === "kpis") {
    const defaultTargetType =
      data.kpiTargetTypes.find((item) => item.code === "COUNTRY") ??
      data.kpiTargetTypes[0];
    return {
      kind: "kpi",
      code: "",
      name: "",
      description: "",
      categoryId: data.kpiCategories[0]?.id ?? "",
      typeId: data.kpiTypes[0]?.id ?? "",
      targetTypeId: defaultTargetType?.id ?? "",
      country,
      teamId: "",
      userId: "",
      targetRole: "",
      unit: "number",
      targetValue: "",
      minValue: "",
      maxValue: "",
      weight: "",
      countsForReporting: true,
      countsForPerformanceCircle: true,
      sortOrder: data.kpis.length + 1,
      validFrom: todayInputValue(),
      validUntil: "",
      evaluationDirection: "HIGHER_IS_BETTER",
      active: true,
    };
  }
  if (section === "kapstok") {
    return {
      kind: "focus",
      code: "",
      name: "",
      sortOrder: data.focuses.length + 1,
    };
  }
  return undefined;
}

function importExportTopicForSection(
  section: Section
): ManagementImportExportTopic | undefined {
  if (section === "teams") return "teams";
  if (section === "kpis") return "kpis";
  if (section === "kapstok") return "kapstok";
  return undefined;
}

function filterKpis(
  data: ManagementConfiguration,
  filters: { query: string; categoryId: string; typeId: string; active: string; scope: string }
) {
  const query = filters.query.trim().toLocaleLowerCase("nl-BE");
  return data.kpis.filter((kpi) => {
    if (filters.active === "active" && !kpi.active) return false;
    if (filters.active === "inactive" && kpi.active) return false;
    if (filters.categoryId && kpi.categoryId !== filters.categoryId) return false;
    if (filters.typeId && kpi.typeId !== filters.typeId) return false;
    if (filters.scope && targetScopeFromId(data, kpi.targetTypeId ?? "") !== filters.scope) return false;
    if (!query) return true;
    return [kpi.code, kpi.name, kpi.description].some((value) =>
      value.toLocaleLowerCase("nl-BE").includes(query)
    );
  });
}

function hasPermission(
  user: ReturnType<typeof useSession>["user"],
  permission: FieldForcePermissionKey
) {
  return user.role === "SUPER_ADMIN" || Boolean(user.permissions?.[permission]);
}

function kpiCardDetail(
  data: ManagementConfiguration,
  kpi: ManagementConfiguration["kpis"][number]
) {
  const category = data.kpiCategories.find((item) => item.id === kpi.categoryId)?.name ?? "Geen categorie";
  const type = data.kpiTypes.find((item) => item.id === kpi.typeId)?.name ?? "Geen type";
  const conflicts = kpi.targets.filter((target) => target.conflict).length;
  const flags = [
    kpi.countsForReporting ? "Rapportage" : undefined,
    kpi.countsForPerformanceCircle ? "Prestatiecirkel" : undefined,
  ].filter(Boolean).join(" + ") || "Niet meetellend";
  return `${kpi.code} | ${category} | ${type} | Doel ${formatKpiSetting(kpi.targetValue, kpi.unit)} | ${kpiScopeDescription(data, kpi)} | ${flags} | ${kpi.targets.length} doelwaarden${conflicts ? `, ${conflicts} conflict` : ""}`;
}

function kpiScopeDescription(
  data: ManagementConfiguration,
  kpi: ManagementConfiguration["kpis"][number]
) {
  const scope = targetScopeFromId(data, kpi.targetTypeId ?? "");
  if (scope === "GLOBAL") return "Globaal";
  if (scope === "COUNTRY") return kpi.country ?? "Land";
  if (scope === "TEAM") return data.teams.find((team) => team.id === kpi.teamId)?.name ?? "Team";
  if (scope === "USER") return "Gebruiker";
  return kpi.targetRole ? roleLabel(kpi.targetRole) : "Rol";
}

function kpiEditorFromItem(item: ManagementConfiguration["kpis"][number]): Extract<EditorState, { kind: "kpi" }> {
  return {
    kind: "kpi",
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId ?? "",
    typeId: item.typeId ?? "",
    targetTypeId: item.targetTypeId ?? "",
    country: item.country,
    teamId: item.teamId ?? "",
    userId: item.userId ?? "",
    targetRole: item.targetRole ?? "",
    unit: item.unit,
    targetValue: String(item.targetValue),
    minValue: item.minValue === null ? "" : String(item.minValue),
    maxValue: item.maxValue === null ? "" : String(item.maxValue),
    weight: item.weight === null ? "" : String(item.weight),
    countsForReporting: item.countsForReporting,
    countsForPerformanceCircle: item.countsForPerformanceCircle,
    sortOrder: item.sortOrder,
    validFrom: item.validFrom,
    validUntil: item.validUntil ?? "",
    evaluationDirection: item.evaluationDirection,
    active: item.active,
  };
}

function kpiTargetEditorFromKpi(
  data: ManagementConfiguration,
  kpi: ManagementConfiguration["kpis"][number]
): Extract<EditorState, { kind: "kpiTarget" }> {
  const scope = targetScopeFromId(data, kpi.targetTypeId ?? "");
  return {
    kind: "kpiTarget",
    kpiDefinitionId: kpi.id,
    targetTypeId: data.kpiTargetTypes.find((item) => item.code === scope)?.id ?? "",
    scope,
    country: kpi.country,
    teamId: kpi.teamId ?? "",
    userId: kpi.userId ?? "",
    role: kpi.targetRole ?? "",
    periodType: "MONTH",
    periodStart: monthStartInputValue(),
    periodEnd: monthEndInputValue(),
    targetValue: String(kpi.targetValue),
    active: true,
  };
}

function kpiTargetEditorFromTarget(
  target: ManagementConfiguration["kpis"][number]["targets"][number]
): Extract<EditorState, { kind: "kpiTarget" }> {
  return {
    kind: "kpiTarget",
    id: target.id,
    kpiDefinitionId: target.kpiDefinitionId,
    targetTypeId: target.targetTypeId,
    scope: target.scope,
    country: target.country,
    teamId: target.teamId ?? "",
    userId: target.userId ?? "",
    role: target.role ?? "",
    periodType: target.periodType,
    periodStart: target.periodStart,
    periodEnd: target.periodEnd,
    targetValue: String(target.targetValue),
    active: target.active,
  };
}

function targetScopeFromId(data: ManagementConfiguration, targetTypeId: string): KpiTargetScope {
  return data.kpiTargetTypes.find((item) => item.id === targetTypeId)?.code ?? "GLOBAL";
}

function kpiEditorHasValidScope(
  data: ManagementConfiguration,
  editor: Extract<EditorState, { kind: "kpi" }>
) {
  const scope = targetScopeFromId(data, editor.targetTypeId);
  if (scope === "GLOBAL") return true;
  if (scope === "COUNTRY") return Boolean(editor.country);
  if (scope === "TEAM") return Boolean(editor.teamId);
  if (scope === "USER") return Boolean(editor.userId);
  return Boolean(editor.targetRole);
}

function kpiTargetEditorHasValidScope(editor: Extract<EditorState, { kind: "kpiTarget" }>) {
  if (editor.scope === "GLOBAL") return true;
  if (editor.scope === "COUNTRY") return Boolean(editor.country);
  if (editor.scope === "TEAM") return Boolean(editor.teamId);
  if (editor.scope === "USER") return Boolean(editor.userId);
  return Boolean(editor.role);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartInputValue() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function monthEndInputValue() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

function countryLabel(country: Country) {
  if (country === "BE") return "België";
  if (country === "NL") return "Nederland";
  return "Duitsland";
}

const roleOptions: Role[] = [
  "REPRESENTATIVE",
  "SALES_LEADER",
  "SALES_MANAGER",
  "COUNTRY_MANAGER",
  "GROUP_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
];

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    REPRESENTATIVE: "Vertegenwoordiger",
    SALES_LEADER: "Verkoopleider",
    SALES_MANAGER: "Sales Manager",
    SERVICE_OPERATOR: "Service Operator",
    COUNTRY_MANAGER: "Country Manager",
    GROUP_MANAGER: "Group Manager",
    ADMIN: "Admin",
    SUPER_ADMIN: "Super Admin",
  };
  return labels[role];
}

function formatKpiSetting(value: number, unit: KpiUnit) {
  const formatted = value.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
  if (unit === "%") return `${formatted}%`;
  if (unit === "EUR") return `€ ${formatted}`;
  if (unit === "minutes") return `${formatted} min`;
  if (unit === "hours") return `${formatted} u`;
  if (unit === "km") return `${formatted} km`;
  return formatted;
}

function ManagementEditor({
  editor,
  data,
  users,
  canChooseCountry,
  onChange,
  onCancel,
  onSave,
}: {
  editor: EditorState;
  data: ManagementConfiguration;
  users: ReturnType<typeof useSession>["managedUsers"];
  canChooseCountry: boolean;
  onChange: (editor: EditorState) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (editor.kind === "purge") {
    return (
      <PermanentDeleteEditor
        entity={editor.entity}
        name={editor.name}
        onCancel={onCancel}
        onDelete={onSave}
      />
    );
  }
  if (editor.kind === "deactivate") {
    return (
      <Modal title="Configuratie deactiveren" onCancel={onCancel}>
        <p className="text-sm text-slate-600">
          Wil je <strong>{editor.name}</strong> deactiveren? Historische gegevens blijven behouden.
        </p>
        <ModalActions
          onCancel={onCancel}
          onSave={onSave}
          saveLabel="Deactiveren"
          danger
        />
      </Modal>
    );
  }
  if (editor.kind === "kpiTarget") {
    return (
      <KpiTargetEditor
        editor={editor}
        data={data}
        users={users}
        canChooseCountry={canChooseCountry}
        onChange={onChange}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  const valid =
    editor.kind === "team"
      ? Boolean(editor.name.trim())
      : editor.kind === "kpi"
        ? Boolean(
            editor.code.trim() &&
            editor.name.trim() &&
            editor.targetValue.trim() &&
            editor.validFrom.trim() &&
            kpiEditorHasValidScope(data, editor) &&
            Number.isFinite(Number(editor.targetValue)) &&
            (!editor.minValue.trim() || Number.isFinite(Number(editor.minValue))) &&
            (!editor.maxValue.trim() || Number.isFinite(Number(editor.maxValue))) &&
            (!editor.weight.trim() || Number.isFinite(Number(editor.weight)))
          )
        : Boolean(
            editor.name.trim() &&
            (editor.kind === "criterion" || editor.code.trim()) &&
            editor.sortOrder > 0
          );
  const entityLabel =
    editor.kind === "team"
      ? "team"
      : editor.kind === "kpi"
        ? "KPI"
        : editor.kind === "focus"
          ? "kapstokfase"
          : "criterium";

  return (
    <Modal title={`${editor.id ? "Bewerken" : "Toevoegen"} ${entityLabel}`} onCancel={onCancel}>
      <div className="space-y-4">
        {(editor.kind === "kpi" || editor.kind === "focus") && (
          <Field label="Code">
            <input
              className="field"
              value={editor.code}
              onChange={(event) => onChange({ ...editor, code: event.target.value })}
            />
          </Field>
        )}
        <Field label={editor.kind === "team" ? "Teamnaam" : "Naam"}>
          <input
            className="field"
            autoFocus
            value={editor.name}
            onChange={(event) => onChange({ ...editor, name: event.target.value })}
          />
        </Field>
        {editor.kind === "team" && (
          <>
            <Field label="Land">
              <select
                className="field disabled:bg-slate-100 disabled:text-slate-500"
                value={editor.country}
                disabled={!canChooseCountry}
                onChange={(event) => onChange({
                  ...editor,
                  country: event.target.value as Country,
                  primaryLeaderId: "",
                })}
              >
                <option value="BE">België</option>
                <option value="NL">Nederland</option>
                <option value="DE">Duitsland</option>
              </select>
            </Field>
            <Field label="Verkoopleider">
              <select
                className="field"
                value={editor.primaryLeaderId}
                onChange={(event) => onChange({
                  ...editor,
                  primaryLeaderId: event.target.value,
                })}
              >
                <option value="">Geen verkoopleider toegewezen</option>
                {users
                  .filter((item) =>
                    item.active &&
                    item.country === editor.country &&
                    item.role !== "REPRESENTATIVE"
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.firstName} {item.lastName} ({item.role})
                    </option>
                  ))}
              </select>
            </Field>
          </>
        )}
        {editor.kind === "kpi" && (
          <>
            <Field label="Beschrijving">
              <textarea
                className="field min-h-24 py-3"
                value={editor.description}
                onChange={(event) => onChange({
                  ...editor,
                  description: event.target.value,
                })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Categorie">
                <select
                  className="field"
                  value={editor.categoryId}
                  onChange={(event) => onChange({ ...editor, categoryId: event.target.value })}
                >
                  {data.kpiCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select
                  className="field"
                  value={editor.typeId}
                  onChange={(event) => onChange({ ...editor, typeId: event.target.value })}
                >
                  {data.kpiTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Scope">
                <select
                  className="field"
                  value={editor.targetTypeId}
                  onChange={(event) => onChange({
                    ...editor,
                    targetTypeId: event.target.value,
                    teamId: "",
                    userId: "",
                    targetRole: "",
                  })}
                >
                  {data.kpiTargetTypes.map((targetType) => (
                    <option key={targetType.id} value={targetType.id}>{targetType.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <KpiScopeFields
              scope={targetScopeFromId(data, editor.targetTypeId)}
              country={editor.country}
              teamId={editor.teamId}
              userId={editor.userId}
              role={editor.targetRole}
              teams={data.teams}
              users={users}
              canChooseCountry={canChooseCountry}
              onCountryChange={(country) => onChange({ ...editor, country, teamId: "", userId: "" })}
              onTeamChange={(teamId) => onChange({ ...editor, teamId })}
              onUserChange={(userId) => onChange({ ...editor, userId })}
              onRoleChange={(role) => onChange({ ...editor, targetRole: role })}
            />
            <Field label="Eenheid">
              <select
                className="field"
                value={editor.unit}
                onChange={(event) => onChange({ ...editor, unit: event.target.value as KpiUnit })}
              >
                {kpiUnitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Doelwaarde">
                <input
                  type="number"
                  step="any"
                  required
                  className="field"
                  value={editor.targetValue}
                  onChange={(event) => onChange({ ...editor, targetValue: event.target.value })}
                />
              </Field>
              <Field label="Minimum (optioneel)">
                <input
                  type="number"
                  step="any"
                  className="field"
                  value={editor.minValue}
                  onChange={(event) => onChange({ ...editor, minValue: event.target.value })}
                />
              </Field>
              <Field label="Maximum (optioneel)">
                <input
                  type="number"
                  step="any"
                  className="field"
                  value={editor.maxValue}
                  onChange={(event) => onChange({ ...editor, maxValue: event.target.value })}
                />
              </Field>
              <Field label="Gewicht">
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="field"
                  value={editor.weight}
                  onChange={(event) => onChange({ ...editor, weight: event.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Volgorde">
                <input
                  type="number"
                  min="0"
                  className="field"
                  value={editor.sortOrder}
                  onChange={(event) => onChange({ ...editor, sortOrder: Number(event.target.value) })}
                />
              </Field>
              <Field label="Van datum">
                <input
                  type="date"
                  className="field"
                  value={editor.validFrom}
                  onChange={(event) => onChange({ ...editor, validFrom: event.target.value })}
                />
              </Field>
              <Field label="Tot datum">
                <input
                  type="date"
                  className="field"
                  value={editor.validUntil}
                  onChange={(event) => onChange({ ...editor, validUntil: event.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <CheckboxField
                label="Actief"
                checked={editor.active}
                onChange={(active) => onChange({ ...editor, active })}
              />
              <CheckboxField
                label="Telt mee in rapportage"
                checked={editor.countsForReporting}
                onChange={(countsForReporting) => onChange({ ...editor, countsForReporting })}
              />
              <CheckboxField
                label="Telt mee in prestatiecirkel"
                checked={editor.countsForPerformanceCircle}
                onChange={(countsForPerformanceCircle) => onChange({ ...editor, countsForPerformanceCircle })}
              />
            </div>
            <Field label="Beoordeling">
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.entries(kpiEvaluationLabels) as [KpiEvaluationDirection, string][]).map(([value, label]) => (
                  <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${editor.evaluationDirection === value ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    <input type="radio" name="evaluationDirection" value={value} checked={editor.evaluationDirection === value} onChange={() => onChange({ ...editor, evaluationDirection: value })} />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            {editor.id && (
              <KpiTargetList
                data={data}
                kpiId={editor.id}
                onAdd={() => onChange(kpiTargetEditorFromKpi(data, data.kpis.find((item) => item.id === editor.id)!))}
                onEdit={(target) => onChange(kpiTargetEditorFromTarget(target))}
                onDelete={(target) => onChange({
                  kind: "deactivate",
                  entity: "kpiTarget",
                  id: target.id,
                  name: `doelwaarde ${target.scopeKey}`,
                })}
              />
            )}
          </>
        )}
        {(editor.kind === "focus" || editor.kind === "criterion") && (
          <Field label="Volgorde">
            <input
              type="number"
              min="1"
              className="field"
              value={editor.sortOrder}
              onChange={(event) => onChange({
                ...editor,
                sortOrder: Number(event.target.value),
              })}
            />
          </Field>
        )}
      </div>
      <ModalActions onCancel={onCancel} onSave={onSave} disabled={!valid} />
    </Modal>
  );
}

function PermanentDeleteEditor({
  entity,
  name,
  onCancel,
  onDelete,
}: {
  entity: string;
  name: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const matches = confirmation.trim().toLocaleLowerCase("nl-BE") === name.trim().toLocaleLowerCase("nl-BE");
  const label = entity === "team" ? "team" : entity === "kpi" ? "KPI" : entity === "focus" ? "kapstokfase" : "criterium";
  return (
    <Modal title={`${label} permanent verwijderen`} onCancel={onCancel}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">
          <strong>{name}</strong> en alle gekoppelde historie worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.
        </p>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Typ <strong className="normal-case text-slate-800">{name}</strong> ter bevestiging
          </span>
          <input
            className="field"
            autoFocus
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
      </div>
      <ModalActions
        onCancel={onCancel}
        onSave={onDelete}
        saveLabel="Permanent verwijderen"
        danger
        disabled={!matches}
      />
    </Modal>
  );
}

function Modal({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-dialog-title"
        className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="management-dialog-title" className="text-lg font-bold text-slate-950">
            {title}
          </h2>
          <button
            type="button"
            title="Sluiten"
            aria-label="Sluiten"
            onClick={onCancel}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ModalActions({
  onCancel,
  onSave,
  saveLabel = "Opslaan",
  danger,
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" className="btn-secondary" onClick={onCancel}>
        Annuleren
      </button>
      <button
        type="button"
        className={danger ? "btn-secondary border-rose-200 text-rose-700" : "btn-primary"}
        disabled={disabled}
        onClick={onSave}
      >
        {saveLabel}
      </button>
    </div>
  );
}
