"use client";

import { Plus, X } from "lucide-react";
import type { WorkflowActionPoint } from "@/lib/types";

export type EditableActionPoint = Omit<WorkflowActionPoint, "id" | "status">;

export function toEditableActionPoint(action: WorkflowActionPoint): EditableActionPoint {
  return { title: action.title, type: action.type, due: action.due };
}

export function ActionPointEditor({
  actions,
  onChange,
  title = "Actiepunten",
  description,
}: {
  actions: EditableActionPoint[];
  onChange: (actions: EditableActionPoint[]) => void;
  title?: string;
  description?: string;
}) {
  return (
    <div>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange([...actions, { title: "", type: "vaardigheid", due: "" }])}
          className="btn-secondary self-start border-dashed"
        >
          <Plus className="h-4 w-4" /> Toevoegen
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {actions.map((action, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_170px_160px_44px]">
            <input
              className="field"
              placeholder="Concrete afspraak"
              value={action.title}
              onChange={(event) => onChange(actions.map((item, itemIndex) =>
                itemIndex === index ? { ...item, title: event.target.value } : item
              ))}
            />
            <select
              className="field"
              value={action.type}
              onChange={(event) => onChange(actions.map((item, itemIndex) =>
                itemIndex === index
                  ? { ...item, type: event.target.value as EditableActionPoint["type"] }
                  : item
              ))}
            >
              <option value="kpi">KPI</option>
              <option value="vaardigheid">Vaardigheid</option>
              <option value="gedrag">Gedrag</option>
            </select>
            <input
              className="field"
              type="date"
              value={action.due}
              onChange={(event) => onChange(actions.map((item, itemIndex) =>
                itemIndex === index ? { ...item, due: event.target.value } : item
              ))}
            />
            <button
              type="button"
              onClick={() => onChange(actions.filter((_, itemIndex) => itemIndex !== index))}
              className="grid h-11 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Actiepunt verwijderen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {actions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
            Nog geen actiepunten toegevoegd.
          </p>
        )}
      </div>
    </div>
  );
}
