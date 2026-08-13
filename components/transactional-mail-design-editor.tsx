"use client";

import { useEffect, useMemo, useState } from "react";
import { TransactionalMailEditor } from "@/components/transactional-mail-editor";
import { buildMailDesign, defaultMailDesign, defaultMailDesignStyles, parseMailDesign, type MailDesignStyles } from "@/lib/mail-design";
import type { Language } from "@/lib/types";

type EditorLabels = Parameters<typeof TransactionalMailEditor>[0]["labels"];
type Parameter = { key: string; descriptionNl?: string; labelNl?: string };
type SavedDesign = { id: string; name: string };

export function TransactionalMailDesignEditor({
  value,
  onChange,
  subject,
  language,
  placeholder,
  helpText,
  labels,
  parameters = [],
  savedDesigns = [],
  onSaveDesign,
  onApplyDesign,
  actorId,
}: {
  value: string;
  onChange: (value: string) => void;
  subject: string;
  language: Language;
  placeholder?: string;
  helpText?: string;
  labels: EditorLabels & { header: string; content: string; footer: string; design: string; colors: string; saveDesign: string; applyDesign: string; noSavedDesigns: string; colorBackground: string; colorCard: string; colorHeader: string; colorHeaderText: string; colorBodyText: string; colorFooter: string; colorFooterText: string; colorLinks: string };
  parameters?: Parameter[];
  savedDesigns?: SavedDesign[];
  onSaveDesign?: () => void;
  onApplyDesign?: (id: string) => void;
  actorId?: string;
}) {
  const initial = useMemo(() => parseMailDesign(value) ?? parseMailDesign(defaultMailDesign(language, value)), [language, value]);
  const [headerHtml, setHeaderHtml] = useState(initial?.headerHtml ?? "");
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml ?? "");
  const [footerHtml, setFooterHtml] = useState(initial?.footerHtml ?? "");
  const [styles, setStyles] = useState<MailDesignStyles>(initial?.styles ?? defaultMailDesignStyles);
  const [selectedDesignId, setSelectedDesignId] = useState("");

  useEffect(() => {
    const next = parseMailDesign(value) ?? parseMailDesign(defaultMailDesign(language, value));
    if (!next) return;
    setHeaderHtml(next.headerHtml);
    setBodyHtml(next.bodyHtml);
    setFooterHtml(next.footerHtml);
    setStyles(next.styles ?? defaultMailDesignStyles);
  }, [language, value]);

  useEffect(() => {
    if (!headerHtml && !bodyHtml && !footerHtml) return;
    onChange(buildMailDesign({ headerHtml, bodyHtml, footerHtml, styles }));
  }, [bodyHtml, footerHtml, headerHtml, onChange, styles]);

  const updateStyle = (key: keyof MailDesignStyles, value: string) => setStyles((current) => ({ ...current, [key]: value }));
  const fields: Array<{ key: keyof MailDesignStyles; label: string }> = [
    { key: "backgroundColor", label: labels.colorBackground },
    { key: "cardColor", label: labels.colorCard },
    { key: "headerColor", label: labels.colorHeader },
    { key: "headerTextColor", label: labels.colorHeaderText },
    { key: "bodyTextColor", label: labels.colorBodyText },
    { key: "footerColor", label: labels.colorFooter },
    { key: "footerTextColor", label: labels.colorFooterText },
    { key: "linkColor", label: labels.colorLinks },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-slate-900">{labels.design}</p>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <label className="min-w-56 flex-1"><span className="block text-xs font-bold text-slate-600">{labels.applyDesign}</span><select className="field mt-1" value={selectedDesignId} onChange={(event) => setSelectedDesignId(event.target.value)}><option value="">{labels.noSavedDesigns}</option>{savedDesigns.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label>
        <button type="button" className="btn-secondary" disabled={!selectedDesignId} onClick={() => { if (selectedDesignId) onApplyDesign?.(selectedDesignId); }}>{labels.applyDesign}</button>
        <button type="button" className="btn-secondary" onClick={() => onSaveDesign?.()}>{labels.saveDesign}</button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-bold text-slate-900">{labels.colors}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{fields.map((field) => <label key={field.key} className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="color" value={styles[field.key]} onChange={(event) => updateStyle(field.key, event.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5" /><span>{field.label}</span></label>)}</div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-300 p-3 sm:p-5" style={{ backgroundColor: styles.backgroundColor }}>
        <div className="mx-auto max-w-[600px] overflow-hidden rounded-xl shadow-sm" style={{ backgroundColor: styles.cardColor }}>
          <div className="mail-design-header rounded-t-xl p-4" style={{ backgroundColor: styles.headerColor, color: styles.headerTextColor }}>
            <TransactionalMailEditor label={labels.header} value={headerHtml} onChange={setHeaderHtml} labels={labels} contentStyle={`color:${styles.headerTextColor};`} actorId={actorId} />
          </div>
          <div className="border-x border-slate-200 px-4 pt-5 sm:px-6" style={{ color: styles.bodyTextColor }}>
            <h3 className="mb-4 text-xl font-bold" style={{ color: styles.bodyTextColor }}>{subject || "Onderwerp van de e-mail"}</h3>
            <TransactionalMailEditor label={labels.content} value={bodyHtml} onChange={setBodyHtml} placeholder={placeholder} helpText={helpText} labels={labels} parameters={parameters} contentStyle={`color:${styles.bodyTextColor};`} actorId={actorId} />
          </div>
          <div className="mail-design-footer border-x border-b border-slate-200 px-4 pb-4 pt-3 sm:px-6" style={{ backgroundColor: styles.footerColor, color: styles.footerTextColor }}>
            <TransactionalMailEditor label={labels.footer} value={footerHtml} onChange={setFooterHtml} labels={labels} contentStyle={`color:${styles.footerTextColor};`} actorId={actorId} />
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">{helpText}</p>
    </div>
  );
}
