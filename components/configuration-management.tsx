"use client";

import { useEffect, useState } from "react";
import { Check, MoreHorizontal, Plus, X } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { EmptyState, PageHeader } from "@/components/ui";
import { fieldForcePermissionGroups } from "@/lib/user-management";
import type {
  Country,
  ManagementConfiguration,
  ManagementFocus,
  ManagementKpi,
  ManagementTeam,
} from "@/lib/types";

type Section = "teams" | "rollen" | "kpis" | "kapstok";

export function ConfigurationManagement({ section }: { section: Section }) {
  const { user, managedUsers } = useSession();
  const [data, setData] = useState<ManagementConfiguration>();
  const [error, setError] = useState<string>();

  async function refresh() {
    const response = await fetch("/api/management", { cache: "no-store" });
    const payload = await response.json() as ManagementConfiguration & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Beheer kon niet worden geladen.");
    setData(payload);
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Beheer kon niet worden geladen."));
  }, []);

  async function mutate(method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) {
    setError(undefined);
    const response = await fetch("/api/management", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, actorId: user.id }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Wijziging kon niet worden opgeslagen.");
      return;
    }
    await refresh();
  }

  if (!data && !error) return <EmptyState title="Beheer laden" description="Configuratie wordt uit MariaDB opgehaald." />;
  if (!data) return <EmptyState title="Beheer niet beschikbaar" description={error ?? "Onbekende fout."} />;

  const titles = {
    teams: "Teams",
    rollen: "Rollen en rechten",
    kpis: "KPI-definities",
    kapstok: "Kapstok beheer",
  };
  const canAdd = section !== "rollen";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuratie"
        title={titles[section]}
        description={user.role === "SUPER_ADMIN" ? "Beheer voor alle landen." : `Beheer voor ${user.country}.`}
        actions={canAdd ? (
          <button className="btn-primary" onClick={() => void createItem(section, user.country, managedUsers, mutate)}>
            <Plus className="h-4 w-4" /> Toevoegen
          </button>
        ) : undefined}
      />
      {error && <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

      {section === "teams" && (
        <Grid>{data.teams.map((item) => (
          <Card key={item.id} title={item.name} detail={`${item.country} · ${item.primaryLeaderName} · ${item.memberCount} leden`} active={item.active}
            onEdit={() => void editTeam(item, managedUsers, mutate)}
            onDelete={() => void deactivate("team", item.id, item.name, mutate)} />
        ))}</Grid>
      )}

      {section === "kpis" && (
        <Grid>{data.kpis.map((item) => (
          <Card key={item.id} title={item.name} detail={`${item.code} · ${item.unit} · ${item.country ?? "Globaal"}`} active={item.active}
            onEdit={() => void editKpi(item, mutate)}
            onDelete={() => void deactivate("kpi", item.id, item.name, mutate)} />
        ))}</Grid>
      )}

      {section === "kapstok" && data.focuses.map((focus) => (
        <section key={focus.id} className="card overflow-hidden">
          <div className="flex items-center gap-3 p-5">
            <div className="flex-1"><h2 className="font-bold">{focus.name}</h2><p className="text-sm text-slate-500">{focus.code} · volgorde {focus.sortOrder}</p></div>
            <button className="btn-secondary" onClick={() => void addCriterion(focus, mutate)}><Plus className="h-4 w-4" /> Criterium</button>
            <Action label="Bewerken" onClick={() => void editFocus(focus, mutate)}><MoreHorizontal /></Action>
            <Action label="Deactiveren" danger onClick={() => void deactivate("focus", focus.id, focus.name, mutate)}><X /></Action>
          </div>
          <div className="divide-y divide-slate-100 border-t">
            {focus.criteria.map((criterion) => (
              <div key={criterion.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-8 text-sm font-bold text-slate-400">{criterion.sortOrder}</span>
                <span className="flex-1 text-sm font-semibold">{criterion.name}</span>
                <Action label="Bewerken" onClick={() => void editCriterion(focus, criterion, mutate)}><MoreHorizontal /></Action>
                <Action label="Deactiveren" danger onClick={() => void deactivate("criterion", criterion.id, criterion.name, mutate)}><X /></Action>
              </div>
            ))}
          </div>
        </section>
      ))}

      {section === "rollen" && data.roles.map((role) => (
        <RolePermissions key={role.role} role={role} mutate={mutate} />
      ))}
    </div>
  );
}

function RolePermissions({ role, mutate }: {
  role: ManagementConfiguration["roles"][number];
  mutate: (method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) => Promise<void>;
}) {
  const [permissions, setPermissions] = useState(role.permissions);
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b p-5">
        <div><h2 className="font-bold">{role.label}</h2><p className="text-sm text-slate-500">{role.userCount} gebruikers · vaste systeemrol</p></div>
        <button className="btn-primary" onClick={() => void mutate("PATCH", { entity: "role", role: role.role, permissions })}><Check className="h-4 w-4" /> Opslaan</button>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        {fieldForcePermissionGroups.map((group) => (
          <fieldset key={group.title}><legend className="mb-2 font-bold">{group.title}</legend>
            {group.permissions.map((permission) => (
              <label key={permission.key} className="mb-2 flex items-center gap-3 text-sm">
                <input type="checkbox" checked={permissions[permission.key]} onChange={(event) => setPermissions({ ...permissions, [permission.key]: event.target.checked })} />
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

function Card({ title, detail, active, onEdit, onDelete }: { title: string; detail: string; active: boolean; onEdit: () => void; onDelete: () => void }) {
  return <article className="card flex items-center gap-3 p-5"><div className="min-w-0 flex-1"><h2 className="truncate font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{detail}</p><p className={`mt-2 text-xs font-bold ${active ? "text-emerald-700" : "text-slate-400"}`}>{active ? "Actief" : "Inactief"}</p></div><Action label="Bewerken" onClick={onEdit}><MoreHorizontal /></Action>{active && <Action label="Deactiveren" danger onClick={onDelete}><X /></Action>}</article>;
}

function Action({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-md ${danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:bg-slate-100"}`}>{children}</button>;
}

async function createItem(section: Section, country: Country, users: ReturnType<typeof useSession>["managedUsers"], mutate: Parameters<typeof ConfigurationManagement>[0] extends never ? never : (method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) => Promise<void>) {
  if (section === "teams") {
    const name = prompt("Teamnaam:"); if (!name) return;
    const leader = chooseLeader(users, country); if (!leader) return;
    await mutate("POST", { entity: "team", name, country, primaryLeaderId: leader });
  } else if (section === "kpis") {
    const code = prompt("KPI-code:"); const name = prompt("KPI-naam:"); if (!code || !name) return;
    await mutate("POST", { entity: "kpi", code, name, description: prompt("Beschrijving:") ?? "", country, unit: prompt("Eenheid (number, %, EUR):", "number") ?? "number" });
  } else if (section === "kapstok") {
    const code = prompt("Fasecode:"); const name = prompt("Fasenaam:"); if (!code || !name) return;
    await mutate("POST", { entity: "focus", code, name, sortOrder: Number(prompt("Volgorde:", "1")) });
  }
}

async function editTeam(item: ManagementTeam, users: ReturnType<typeof useSession>["managedUsers"], mutate: Mutation) {
  const name = prompt("Teamnaam:", item.name); if (!name) return;
  const leader = chooseLeader(users, item.country, item.primaryLeaderId); if (!leader) return;
  await mutate("PATCH", { entity: "team", id: item.id, name, country: item.country, primaryLeaderId: leader });
}
async function editKpi(item: ManagementKpi, mutate: Mutation) {
  const name = prompt("KPI-naam:", item.name); if (!name) return;
  await mutate("PATCH", { entity: "kpi", id: item.id, code: prompt("Code:", item.code) ?? item.code, name, description: prompt("Beschrijving:", item.description) ?? item.description, country: item.country, unit: prompt("Eenheid:", item.unit) ?? item.unit });
}
async function editFocus(item: ManagementFocus, mutate: Mutation) {
  const name = prompt("Fasenaam:", item.name); if (!name) return;
  await mutate("PATCH", { entity: "focus", id: item.id, code: prompt("Code:", item.code) ?? item.code, name, sortOrder: Number(prompt("Volgorde:", String(item.sortOrder))) });
}
async function addCriterion(focus: ManagementFocus, mutate: Mutation) {
  const name = prompt("Criterium:"); if (!name) return;
  await mutate("POST", { entity: "criterion", focusId: focus.id, name, sortOrder: focus.criteria.length + 1 });
}
async function editCriterion(focus: ManagementFocus, item: ManagementFocus["criteria"][number], mutate: Mutation) {
  const name = prompt("Criterium:", item.name); if (!name) return;
  await mutate("PATCH", { entity: "criterion", id: item.id, focusId: focus.id, name, sortOrder: Number(prompt("Volgorde:", String(item.sortOrder))) });
}
async function deactivate(entity: string, id: string, name: string, mutate: Mutation) {
  if (confirm(`"${name}" deactiveren? Historische gegevens blijven behouden.`)) await mutate("DELETE", { entity, id });
}
function chooseLeader(users: ReturnType<typeof useSession>["managedUsers"], country: Country, current = "") {
  const options = users.filter((item) => item.active && item.country === country && item.role !== "REPRESENTATIVE");
  const listing = options.map((item) => `${item.id}: ${item.firstName} ${item.lastName}`).join("\n");
  return prompt(`Geef het ID van de primaire teamleider:\n${listing}`, current) ?? "";
}
type Mutation = (method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) => Promise<void>;
