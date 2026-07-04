"use client";

import { useEffect, useState } from "react";
import { Check, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { EmptyState, PageHeader } from "@/components/ui";
import { fieldForcePermissionGroups } from "@/lib/user-management";
import { kpiEvaluationLabels, kpiUnitOptions } from "@/lib/kpi-settings";
import type {
  Country,
  KpiEvaluationDirection,
  KpiUnit,
  ManagementConfiguration,
} from "@/lib/types";

type Section = "teams" | "rollen" | "kpis" | "kapstok";
type Mutation = (
  method: "POST" | "PATCH" | "DELETE",
  payload: Record<string, unknown>
) => Promise<boolean>;
type EditorState =
  | { kind: "team"; id?: string; name: string; country: Country; primaryLeaderId: string }
  | { kind: "kpi"; id?: string; code: string; name: string; description: string; country: Country | null; unit: KpiUnit; targetValue: string; minValue: string; maxValue: string; evaluationDirection: KpiEvaluationDirection }
  | { kind: "focus"; id?: string; code: string; name: string; sortOrder: number }
  | { kind: "criterion"; id?: string; focusId: string; name: string; sortOrder: number }
  | { kind: "deactivate"; entity: string; id: string; name: string }
  | { kind: "purge"; entity: string; id: string; name: string };

export function ConfigurationManagement({ section }: { section: Section }) {
  const { user, managedUsers } = useSession();
  const [data, setData] = useState<ManagementConfiguration>();
  const [error, setError] = useState<string>();
  const [editor, setEditor] = useState<EditorState>();

  async function refresh() {
    const response = await fetch("/api/management", { cache: "no-store" });
    const payload = await response.json() as ManagementConfiguration & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Beheer kon niet worden geladen.");
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuratie"
        title={titles[section]}
        description={user.role === "SUPER_ADMIN" ? "Beheer voor alle landen." : `Beheer voor ${user.country}.`}
        actions={section !== "rollen" ? (
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

      {section === "teams" && (
        <>
          <StatusGroup title="Actieve teams" count={data.teams.filter((item) => item.active).length}>
            <Grid>
          {data.teams.filter((item) => item.active).map((item) => (
            <Card
              key={item.id}
              title={item.name}
              detail={`${item.country} | ${item.primaryLeaderName} | ${item.memberCount} leden`}
              active={item.active}
              onEdit={() => setEditor({
                kind: "team",
                id: item.id,
                name: item.name,
                country: item.country,
                primaryLeaderId: item.primaryLeaderId,
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
              detail={`${item.country} | ${item.primaryLeaderName} | ${item.memberCount} leden`}
              active={item.active}
              onEdit={() => setEditor({
                kind: "team",
                id: item.id,
                name: item.name,
                country: item.country,
                primaryLeaderId: item.primaryLeaderId,
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
          <StatusGroup title="Actieve KPI's" count={data.kpis.filter((item) => item.active).length}>
            <Grid>
          {data.kpis.filter((item) => item.active).map((item) => (
            <Card
              key={item.id}
              title={item.name}
              detail={`${item.code} | Doel ${formatKpiSetting(item.targetValue, item.unit)} | ${kpiEvaluationLabels[item.evaluationDirection]} | ${item.country ?? "Globaal"}`}
              active={item.active}
              onEdit={() => setEditor({
                kind: "kpi",
                id: item.id,
                code: item.code,
                name: item.name,
                description: item.description,
                country: item.country,
                unit: item.unit,
                targetValue: String(item.targetValue),
                minValue: item.minValue === null ? "" : String(item.minValue),
                maxValue: item.maxValue === null ? "" : String(item.maxValue),
                evaluationDirection: item.evaluationDirection,
              })}
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
          <StatusGroup title="Niet-actieve KPI's" count={data.kpis.filter((item) => !item.active).length}>
            <Grid>
          {data.kpis.filter((item) => !item.active).map((item) => (
            <Card
              key={item.id}
              title={item.name}
              detail={`${item.code} | Doel ${formatKpiSetting(item.targetValue, item.unit)} | ${kpiEvaluationLabels[item.evaluationDirection]} | ${item.country ?? "Globaal"}`}
              active={item.active}
              onEdit={() => setEditor({
                kind: "kpi",
                id: item.id,
                code: item.code,
                name: item.name,
                description: item.description,
                country: item.country,
                unit: item.unit,
                targetValue: String(item.targetValue),
                minValue: item.minValue === null ? "" : String(item.minValue),
                maxValue: item.maxValue === null ? "" : String(item.maxValue),
                evaluationDirection: item.evaluationDirection,
              })}
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
          <StatusGroup title="Actieve rollen" count={data.roles.filter((role) => role.userCount > 0).length} description="Rollen die momenteel aan gebruikers zijn toegewezen.">
            <div className="space-y-4">
              {data.roles.filter((role) => role.userCount > 0).map((role) => (
                <RolePermissions key={role.role} role={role} mutate={mutate} />
              ))}
            </div>
          </StatusGroup>
          <StatusGroup title="Niet-actieve rollen" count={data.roles.filter((role) => role.userCount === 0).length} description="Vaste systeemrollen die momenteel niet in gebruik zijn.">
            <div className="space-y-4">
              {data.roles.filter((role) => role.userCount === 0).map((role) => (
                <RolePermissions key={role.role} role={role} mutate={mutate} />
              ))}
            </div>
          </StatusGroup>
        </>
      )}

      {editor && (
        <ManagementEditor
          editor={editor}
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
  mutate,
}: {
  role: ManagementConfiguration["roles"][number];
  mutate: Mutation;
}) {
  const [permissions, setPermissions] = useState(role.permissions);
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <h2 className="font-bold">{role.label}</h2>
          <p className="text-sm text-slate-500">{role.userCount} gebruikers | vaste systeemrol</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void mutate("PATCH", {
            entity: "role",
            role: role.role,
            permissions,
          })}
        >
          <Check className="h-4 w-4" /> Opslaan
        </button>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        {fieldForcePermissionGroups.map((group) => (
          <fieldset key={group.title}>
            <legend className="mb-2 font-bold">{group.title}</legend>
            {group.permissions.map((permission) => (
              <label key={permission.key} className="mb-2 flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={permissions[permission.key]}
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
  onDelete,
  onPermanentDelete,
}: {
  title: string;
  detail: string;
  active: boolean;
  onEdit: () => void;
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

function newEditor(
  section: Section,
  country: Country,
  data: ManagementConfiguration
): EditorState | undefined {
  if (section === "teams") {
    return { kind: "team", name: "", country, primaryLeaderId: "" };
  }
  if (section === "kpis") {
    return {
      kind: "kpi",
      code: "",
      name: "",
      description: "",
      country,
      unit: "number",
      targetValue: "",
      minValue: "",
      maxValue: "",
      evaluationDirection: "HIGHER_IS_BETTER",
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
  users,
  canChooseCountry,
  onChange,
  onCancel,
  onSave,
}: {
  editor: EditorState;
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

  const valid =
    editor.kind === "team"
      ? Boolean(editor.name.trim() && editor.primaryLeaderId)
      : editor.kind === "kpi"
        ? Boolean(
            editor.code.trim() &&
            editor.name.trim() &&
            editor.targetValue.trim() &&
            Number.isFinite(Number(editor.targetValue)) &&
            (!editor.minValue.trim() || Number.isFinite(Number(editor.minValue))) &&
            (!editor.maxValue.trim() || Number.isFinite(Number(editor.maxValue)))
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
        {editor.kind !== "team" && editor.kind !== "criterion" && (
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
            <Field label="Primaire teamleider">
              <select
                className="field"
                value={editor.primaryLeaderId}
                onChange={(event) => onChange({
                  ...editor,
                  primaryLeaderId: event.target.value,
                })}
              >
                <option value="">Selecteer een teamleider</option>
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
            <Field label="Eenheid">
              <select
                className="field"
                value={editor.unit}
                onChange={(event) => onChange({ ...editor, unit: event.target.value as KpiUnit })}
              >
                {kpiUnitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
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
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
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
