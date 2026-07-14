import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col lg:flex-row lg:items-end lg:justify-between ${compact ? "gap-2.5" : "gap-4"}`}>
      <div>
        {eyebrow && <p className={`eyebrow ${compact ? "mb-1" : "mb-2"}`}>{eyebrow}</p>}
        <h1 className={`font-bold tracking-tight text-slate-950 ${compact ? "text-2xl" : "text-2xl sm:text-3xl"}`}>{title}</h1>
        {description && (
          <p className={`max-w-2xl text-sm text-slate-500 ${compact ? "mt-1 leading-5" : "mt-2 leading-6"}`}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  concept: "bg-slate-100 text-slate-700",
  gepland: "bg-blue-100 text-blue-800",
  in_uitvoering: "bg-amber-100 text-amber-800",
  gesloten: "bg-slate-100 text-slate-700",
  gefinaliseerd: "bg-emerald-100 text-emerald-800",
  voltooid: "bg-emerald-100 text-emerald-800",
  verzonden_ter_akkoord: "bg-fuchsia-100 text-fuchsia-800",
  akkoord_door_vertegenwoordiger: "bg-teal-100 text-teal-800",
  wacht_op_vt: "bg-violet-100 text-violet-800",
  wacht_op_akkoord: "bg-fuchsia-100 text-fuchsia-800",
  wacht_op_vt_input: "bg-violet-100 text-violet-800",
  in_behandeling: "bg-amber-100 text-amber-800",
  vervolgactie_gepland: "bg-blue-100 text-blue-800",
  afgesloten: "bg-emerald-100 text-emerald-800",
  geannuleerd: "bg-rose-100 text-rose-800",
  afgerond: "bg-emerald-100 text-emerald-800",
  nieuw: "bg-sky-100 text-sky-800",
  behaald: "bg-emerald-100 text-emerald-800",
  open: "bg-sky-100 text-sky-800",
  niet_behaald: "bg-rose-100 text-rose-800",
  achterstallig: "bg-rose-100 text-rose-800",
  gelezen_akkoord: "bg-emerald-100 text-emerald-800",
  gelezen_niet_akkoord: "bg-rose-100 text-rose-800",
};

const statusLabels: Record<string, string> = {
  concept: "Concept",
  gepland: "Gepland",
  in_uitvoering: "In uitvoering",
  gesloten: "Gesloten",
  gefinaliseerd: "Gefinaliseerd",
  voltooid: "Afgewerkt",
  verzonden_ter_akkoord: "Ter akkoord verzonden",
  akkoord_door_vertegenwoordiger: "Voor akkoord bevestigd",
  wacht_op_vt: "Wacht op VT",
  wacht_op_akkoord: "Wacht op akkoord",
  wacht_op_vt_input: "Wacht op VT-input",
  in_behandeling: "In behandeling",
  vervolgactie_gepland: "Vervolgactie gepland",
  afgesloten: "Afgesloten",
  geannuleerd: "Geannuleerd",
  afgerond: "Afgerond",
  nieuw: "Nieuw",
  behaald: "Behaald",
  open: "Open",
  niet_behaald: "Niet behaald",
  achterstallig: "Achterstallig",
  gelezen_akkoord: "Gelezen en akkoord",
  gelezen_niet_akkoord: "Gelezen, niet akkoord",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status] ?? statusStyles.concept}`}>
      {label ?? statusLabels[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function Avatar({
  initials,
  className = "",
  src,
  alt = "",
}: {
  initials: string;
  className?: string;
  src?: string;
  alt?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [src]);
  const showImage = Boolean(src && !imageFailed);
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-100 font-bold text-brand-700 ${className || "h-11 w-11 text-sm"}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Private API-backed avatars are not compatible with Next image optimization.
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        initials
      )}
    </div>
  );
}

export function Trend({ value }: { value: number }) {
  if (value > 0) return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4 text-rose-500" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card grid min-h-64 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-brand-50" />
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
