"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Save, Send } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { TransactionalMailDesignEditor } from "@/components/transactional-mail-design-editor";
import { EmptyState, PageHeader } from "@/components/ui";
import { translate } from "@/lib/i18n";
import { buildMailDesign, defaultMailDesign, parseMailDesign } from "@/lib/mail-design";
import type { Country, Language } from "@/lib/types";

type TemplateRow = {
  id: string;
  type: string;
  functionalNameNl: string;
  descriptionNl: string;
  triggerDescriptionNl: string;
  moduleCode: string;
  scopeLevel: string;
  scopeKey: string;
  languages: Array<{ language: Language; configured: boolean; published: boolean; version: number | null; publishedAt: string | null }>;
  parameters: Array<{ key: string; labelNl: string; descriptionNl: string; dataType: string; exampleValue: string | null; required: boolean }>;
};

type TemplateVersion = {
  id: string;
  language: Language;
  version: number;
  status: "DRAFT" | "PUBLISHED";
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  createdAt: string;
  publishedAt: string | null;
  changeNote: string | null;
};

type TemplateEditor = {
  type: string;
  functionalNameNl: string;
  descriptionNl: string;
  triggerDescriptionNl: string;
  moduleCode: string;
  scopeKey: string;
  scopeLevel: string;
  parameters: TemplateRow["parameters"];
  versions: TemplateVersion[];
  fallbackVersions?: TemplateVersion[];
};
type SavedMailDesign = { id: string; name: string; bodyHtml: string };

export function TransactionalMailManagement() {
  const { user } = useSession();
  const language = user.language;
  const t = useMemo(() => (key: Parameters<typeof translate>[1]) => translate(language, key), [language]);
  const editorLabels = useMemo(() => mailEditorLabels(t), [t]);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [editor, setEditor] = useState<TemplateEditor | null>(null);
  const [editorLanguage, setEditorLanguage] = useState<Language>(language);
  const [editorCountry, setEditorCountry] = useState<Country>(user.country);
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [savedDesigns, setSavedDesigns] = useState<SavedMailDesign[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/management/mail/templates?actorId=${encodeURIComponent(user.id)}&country=${encodeURIComponent(editorCountry)}`)
      .then(async (response) => {
        const payload = await response.json() as { templates?: TemplateRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
        if (!cancelled) {
          setRows(payload.templates ?? []);
          setSelectedType((current) => current || payload.templates?.[0]?.type || "");
        }
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); });
    return () => { cancelled = true; };
  }, [editorCountry, t, user.id]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/management/mail/designs?actorId=${encodeURIComponent(user.id)}`)
      .then(async (response) => {
        const payload = await response.json() as { designs?: SavedMailDesign[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
        if (!cancelled) setSavedDesigns(payload.designs ?? []);
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); });
    return () => { cancelled = true; };
  }, [t, user.id]);

  useEffect(() => {
    if (!selectedType) return;
    let cancelled = false;
    void fetch(`/api/management/mail/templates/${encodeURIComponent(selectedType)}?actorId=${encodeURIComponent(user.id)}&scopeKey=${encodeURIComponent(`COUNTRY:${editorCountry}`)}`)
      .then(async (response) => {
        const payload = await response.json() as { template?: TemplateEditor; error?: string };
        if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
        if (!cancelled && payload.template) {
          setEditor(payload.template);
          applyVersion(payload.template.versions, payload.template.fallbackVersions ?? [], editorLanguage, setSubject, setPreheader, setBodyHtml);
        }
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); });
    return () => { cancelled = true; };
  }, [editorCountry, editorLanguage, selectedType, t, user.id]);

  const filteredRows = useMemo(() => rows.filter((row) => `${row.type} ${row.functionalNameNl} ${row.moduleCode}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const currentVersions = editor?.versions.filter((version) => version.language === editorLanguage) ?? [];
  const latestDraft = currentVersions.find((version) => version.status === "DRAFT");

  async function saveDraft() {
    if (!editor) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(`/api/management/mail/templates/${encodeURIComponent(editor.type)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actorId: user.id, action: "save", scopeLevel: "COUNTRY", country: editorCountry, language: editorLanguage, subject, preheader, bodyHtml, moduleCode: editor.moduleCode }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
      setMessage(t("mailManagement.saved"));
      await reloadEditor(editor.type);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  async function publish(versionId: string) {
    if (!window.confirm(t("mailManagement.publish"))) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(`/api/management/mail/templates/${encodeURIComponent(selectedType)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: user.id, action: "publish", versionId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
      setMessage(t("mailManagement.publishedMessage"));
      await reloadEditor(selectedType);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  async function restore(versionId: string) {
    if (!window.confirm(t("mailManagement.restore"))) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(`/api/management/mail/templates/${encodeURIComponent(selectedType)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: user.id, action: "restore", versionId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
      setMessage(t("mailManagement.restoredMessage"));
      await reloadEditor(selectedType);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  async function sendTest(versionId: string) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(`/api/management/mail/templates/${encodeURIComponent(selectedType)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: user.id, action: "test", versionId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
      setMessage(t("mailManagement.testSent"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  async function sendCurrentTest() {
    if (!editor) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch(`/api/management/mail/templates/${encodeURIComponent(editor.type)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: user.id, action: "testCurrent", country: editorCountry, language: editorLanguage, subject, preheader, bodyHtml }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
      setMessage(t("mailManagement.currentTestSent"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  async function saveReusableDesign() {
    const name = window.prompt(t("mailManagement.designNamePrompt"));
    if (!name?.trim()) return;
    const design = parseMailDesign(bodyHtml) ?? parseMailDesign(defaultMailDesign(editorLanguage, bodyHtml));
    if (!design) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const response = await fetch("/api/management/mail/designs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: user.id, name, bodyHtml: buildMailDesign(design) }) });
      const payload = await response.json() as { design?: SavedMailDesign; error?: string };
      if (!response.ok || !payload.design) throw new Error(payload.error ?? t("mailManagement.loadError"));
      setSavedDesigns((current) => [payload.design as SavedMailDesign, ...current]);
      setMessage(t("mailManagement.designSaved"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  function applyReusableDesign(id: string) {
    const saved = savedDesigns.find((design) => design.id === id);
    if (!saved) return;
    const source = parseMailDesign(saved.bodyHtml);
    const current = parseMailDesign(bodyHtml) ?? parseMailDesign(defaultMailDesign(editorLanguage, bodyHtml));
    if (!source || !current) return;
    setBodyHtml(buildMailDesign({ headerHtml: source.headerHtml, bodyHtml: current.bodyHtml, footerHtml: source.footerHtml, styles: source.styles }));
    setMessage(t("mailManagement.designApplied"));
  }

  async function reloadEditor(type: string) {
    const response = await fetch(`/api/management/mail/templates/${encodeURIComponent(type)}?actorId=${encodeURIComponent(user.id)}&scopeKey=${encodeURIComponent(`COUNTRY:${editorCountry}`)}`);
    const payload = await response.json() as { template?: TemplateEditor };
    if (!response.ok || !payload.template) return;
    setEditor(payload.template);
    applyVersion(payload.template.versions, payload.template.fallbackVersions ?? [], editorLanguage, setSubject, setPreheader, setBodyHtml);
  }

  if (error && !rows.length) return <EmptyState title={t("mailManagement.loadError")} description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Beheer" title={t("mailManagement.title")} description={t("mailManagement.description")} />
      {message && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><Check className="h-4 w-4" />{message}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 p-4"><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("mailManagement.search")} /></div>
          <div className="max-h-[680px] overflow-auto p-2">
            {!rows.length && <p className="p-4 text-sm text-slate-500">{t("mailManagement.noTemplates")}</p>}
            {filteredRows.map((row) => <button key={`${row.type}:${row.scopeKey}`} type="button" onClick={() => setSelectedType(row.type)} className={`w-full rounded-xl p-3 text-left transition ${selectedType === row.type ? "bg-brand-50 text-brand-900" : "hover:bg-slate-50"}`}><p className="font-bold">{row.functionalNameNl}</p><p className="mt-1 text-xs text-slate-500">{row.type} · {row.moduleCode}</p><div className="mt-2 flex flex-wrap gap-1">{row.languages.map((item) => <span key={item.language} title={item.configured ? t("mailManagement.languageConfigured") : t("mailManagement.languageMissing")} aria-label={`${item.language}: ${item.configured ? t("mailManagement.languageConfigured") : t("mailManagement.languageMissing")}`} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.configured ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.language}</span>)}</div></button>)}
          </div>
        </section>
        <section className="space-y-5">
          {!editor && <div className="card p-8"><p className="text-sm text-slate-500">{t("mailManagement.select")}</p></div>}
          {editor && <>
            <div className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{editor.moduleCode} · {editor.type}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{editor.functionalNameNl}</h2><p className="mt-1 text-sm text-slate-500">{editor.descriptionNl}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{t("mailManagement.effectiveLevel")}: {editor.scopeLevel}</span></div><p className="mt-3 text-sm text-slate-600">{editor.triggerDescriptionNl}</p></div>
            <div className="card space-y-5 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4"><div className="flex flex-wrap gap-3"><label className="block min-w-[10rem]"><span className="block text-sm font-bold text-slate-900">{t("mailManagement.country")}</span><select className="field mt-2" value={editorCountry} onChange={(event) => setEditorCountry(event.target.value as Country)}><option value="BE">BE</option><option value="NL">NL</option><option value="DE">DE</option></select></label><label className="block min-w-[12rem]"><span className="block text-sm font-bold text-slate-900">{t("mailManagement.language")}</span><select className="field mt-2" value={editorLanguage} onChange={(event) => { const next = event.target.value as Language; setEditorLanguage(next); applyVersion(editor.versions, editor.fallbackVersions ?? [], next, setSubject, setPreheader, setBodyHtml); }}><option value="nl">Nederlands</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={busy} onClick={() => void saveDraft()}><Save className="h-4 w-4" />{t("mailManagement.save")}</button>{latestDraft && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void publish(latestDraft.id)}><Send className="h-4 w-4" />{t("mailManagement.publish")}</button>}</div></div>
              <label className="block"><span className="block text-sm font-bold text-slate-900">{t("mailManagement.subject")}</span><input className="field mt-2 w-full" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
              <label className="block"><span className="block text-sm font-bold text-slate-900">{t("mailManagement.preheader")}</span><input className="field mt-2 w-full" value={preheader} onChange={(event) => setPreheader(event.target.value)} /></label>
              <TransactionalMailDesignEditor value={bodyHtml} onChange={setBodyHtml} subject={subject} language={editorLanguage} placeholder={t("mailManagement.bodyPlaceholder")} helpText={t("mailManagement.editorHelp")} parameters={editor.parameters} labels={editorLabels} savedDesigns={savedDesigns} onSaveDesign={() => void saveReusableDesign()} onApplyDesign={applyReusableDesign} actorId={user.id} />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4"><div><p className="text-sm font-bold text-brand-950">{t("mailManagement.currentTestTitle")}</p><p className="mt-1 text-xs text-brand-800">{t("mailManagement.currentTestDescription")}</p></div><button type="button" className="btn-primary" disabled={busy} onClick={() => void sendCurrentTest()}><Send className="h-4 w-4" />{t("mailManagement.test")}</button></div>
            </div>
            <div className="card p-5"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-slate-500" /><h3 className="font-bold text-slate-950">{t("mailManagement.version")}</h3></div><div className="mt-3 space-y-2">{currentVersions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-bold">{t("mailManagement.version")} {version.version} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase ${version.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{version.status === "PUBLISHED" ? t("mailManagement.published") : t("mailManagement.draft")}</span></p><p className="mt-1 text-xs text-slate-500">{version.changeNote || "-"}</p></div><div className="flex flex-wrap gap-2">{version.status === "DRAFT" && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void publish(version.id)}><Send className="h-4 w-4" />{t("mailManagement.publish")}</button>}<button type="button" className="btn-secondary" disabled={busy} onClick={() => void sendTest(version.id)}><Send className="h-4 w-4" />{t("mailManagement.test")}</button>{version.status === "PUBLISHED" && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void restore(version.id)}><RefreshCw className="h-4 w-4" />{t("mailManagement.restore")}</button>}</div></div>)}</div></div>
          </>}
        </section>
      </div>
    </div>
  );
}

function mailEditorLabels(t: (key: Parameters<typeof translate>[1]) => string) {
  return {
    bold: t("mailManagement.editor.bold"), italic: t("mailManagement.editor.italic"), underline: t("mailManagement.editor.underline"), strike: t("mailManagement.editor.strike"), heading: t("mailManagement.editor.heading"), paragraph: t("mailManagement.editor.paragraph"), bulletList: t("mailManagement.editor.bulletList"), numberedList: t("mailManagement.editor.numberedList"), quote: t("mailManagement.editor.quote"), link: t("mailManagement.editor.link"), unlink: t("mailManagement.editor.unlink"), image: t("mailManagement.editor.image"), alignLeft: t("mailManagement.editor.alignLeft"), alignCenter: t("mailManagement.editor.alignCenter"), alignRight: t("mailManagement.editor.alignRight"), highlight: t("mailManagement.editor.highlight"), textColor: t("mailManagement.editor.textColor"), undo: t("mailManagement.editor.undo"), redo: t("mailManagement.editor.redo"), clear: t("mailManagement.editor.clear"), table: t("mailManagement.editor.table"), parameter: t("mailManagement.editor.parameter"), linkPrompt: t("mailManagement.editor.linkPrompt"), imagePrompt: t("mailManagement.editor.imagePrompt"), imageAltPrompt: t("mailManagement.editor.imageAltPrompt"),
    design: t("mailManagement.design"), header: t("mailManagement.header"), content: t("mailManagement.content"), footer: t("mailManagement.footer"), colors: t("mailManagement.colors"), saveDesign: t("mailManagement.saveDesign"), applyDesign: t("mailManagement.applyDesign"), noSavedDesigns: t("mailManagement.noSavedDesigns"), colorBackground: t("mailManagement.colorBackground"), colorCard: t("mailManagement.colorCard"), colorHeader: t("mailManagement.colorHeader"), colorHeaderText: t("mailManagement.colorHeaderText"), colorBodyText: t("mailManagement.colorBodyText"), colorFooter: t("mailManagement.colorFooter"), colorFooterText: t("mailManagement.colorFooterText"), colorLinks: t("mailManagement.colorLinks"), imageUpload: t("mailManagement.editor.imageUpload"), imageUrl: t("mailManagement.editor.imageUrl"), imageFile: t("mailManagement.editor.imageFile"), imageWidth: t("mailManagement.editor.imageWidth"), imageHeight: t("mailManagement.editor.imageHeight"), imageKeepRatio: t("mailManagement.editor.imageKeepRatio"), imageInsert: t("mailManagement.editor.imageInsert"), imageCancel: t("mailManagement.editor.imageCancel"), imageUploading: t("mailManagement.editor.imageUploading"), imageUploadError: t("mailManagement.editor.imageUploadError"),
  };
}

function applyVersion(versions: TemplateVersion[], fallbackVersions: TemplateVersion[], language: Language, setSubject: (value: string) => void, setPreheader: (value: string) => void, setBodyHtml: (value: string) => void) {
  const version = versions.filter((item) => item.language === language).sort((left, right) => right.version - left.version)[0] ?? fallbackVersions.filter((item) => item.language === language).sort((left, right) => right.version - left.version)[0];
  setSubject(version?.subject ?? "");
  setPreheader(version?.preheader ?? "");
  setBodyHtml(version?.bodyHtml ?? "");
}
