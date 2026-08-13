"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Save, Send } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { RichTextEditor } from "@/components/rich-text-editor";
import { EmptyState, PageHeader } from "@/components/ui";
import { translate } from "@/lib/i18n";
import type { Language } from "@/lib/types";

type TemplateRow = {
  id: string;
  type: string;
  functionalNameNl: string;
  descriptionNl: string;
  triggerDescriptionNl: string;
  moduleCode: string;
  scopeLevel: string;
  scopeKey: string;
  languages: Array<{ language: Language; published: boolean; version: number | null; publishedAt: string | null }>;
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
};

export function TransactionalMailManagement() {
  const { user } = useSession();
  const language = user.language;
  const t = useMemo(() => (key: Parameters<typeof translate>[1]) => translate(language, key), [language]);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [editor, setEditor] = useState<TemplateEditor | null>(null);
  const [editorLanguage, setEditorLanguage] = useState<Language>(language);
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/management/mail/templates?actorId=${encodeURIComponent(user.id)}`)
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
  }, [t, user.id]);

  useEffect(() => {
    if (!selectedType) return;
    let cancelled = false;
    void fetch(`/api/management/mail/templates/${encodeURIComponent(selectedType)}?actorId=${encodeURIComponent(user.id)}`)
      .then(async (response) => {
        const payload = await response.json() as { template?: TemplateEditor; error?: string };
        if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
        if (!cancelled && payload.template) {
          setEditor(payload.template);
          applyVersion(payload.template.versions, editorLanguage, setSubject, setPreheader, setBodyHtml);
        }
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); });
    return () => { cancelled = true; };
  }, [editorLanguage, selectedType, t, user.id]);

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
        body: JSON.stringify({ actorId: user.id, action: "save", scopeLevel: editor.scopeLevel, language: editorLanguage, subject, preheader, bodyHtml, moduleCode: editor.moduleCode }),
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

  async function reloadEditor(type: string) {
    const response = await fetch(`/api/management/mail/templates/${encodeURIComponent(type)}?actorId=${encodeURIComponent(user.id)}`);
    const payload = await response.json() as { template?: TemplateEditor };
    if (!response.ok || !payload.template) return;
    setEditor(payload.template);
    applyVersion(payload.template.versions, editorLanguage, setSubject, setPreheader, setBodyHtml);
  }

  function insertParameter(key: string) {
    setBodyHtml((current) => `${current} {{${key}}}`);
  }

  if (error && !rows.length) return <EmptyState title={t("mailManagement.loadError")} description={error} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Beheer" title={t("mailManagement.title")} description={t("mailManagement.description")} />
      {message && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><Check className="h-4 w-4" />{message}</div>}
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 p-4"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("mailManagement.search")} /></div>
          <div className="max-h-[680px] overflow-auto p-2">
            {!rows.length && <p className="p-4 text-sm text-slate-500">{t("mailManagement.noTemplates")}</p>}
            {filteredRows.map((row) => <button key={`${row.type}:${row.scopeKey}`} type="button" onClick={() => setSelectedType(row.type)} className={`w-full rounded-xl p-3 text-left transition ${selectedType === row.type ? "bg-brand-50 text-brand-900" : "hover:bg-slate-50"}`}><p className="font-bold">{row.functionalNameNl}</p><p className="mt-1 text-xs text-slate-500">{row.type} · {row.moduleCode}</p><div className="mt-2 flex flex-wrap gap-1">{row.languages.map((item) => <span key={item.language} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.language}</span>)}</div></button>)}
          </div>
        </section>
        <section className="space-y-5">
          {!editor && <div className="card p-8"><p className="text-sm text-slate-500">{t("mailManagement.select")}</p></div>}
          {editor && <>
            <div className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{editor.moduleCode} · {editor.type}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{editor.functionalNameNl}</h2><p className="mt-1 text-sm text-slate-500">{editor.descriptionNl}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{t("mailManagement.effectiveLevel")}: {editor.scopeLevel}</span></div><p className="mt-3 text-sm text-slate-600">{editor.triggerDescriptionNl}</p></div>
            <div className="card space-y-5 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3"><label className="block"><span className="text-sm font-bold text-slate-900">{t("mailManagement.language")}</span><select className="input mt-2" value={editorLanguage} onChange={(event) => { const next = event.target.value as Language; setEditorLanguage(next); applyVersion(editor.versions, next, setSubject, setPreheader, setBodyHtml); }}><option value="nl">Nederlands</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label><div className="flex gap-2"><button type="button" className="btn-primary" disabled={busy} onClick={() => void saveDraft()}><Save className="h-4 w-4" />{t("mailManagement.save")}</button>{latestDraft && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void publish(latestDraft.id)}><Send className="h-4 w-4" />{t("mailManagement.publish")}</button>}</div></div>
              <label className="block"><span className="text-sm font-bold text-slate-900">{t("mailManagement.subject")}</span><input className="input mt-2" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
              <label className="block"><span className="text-sm font-bold text-slate-900">{t("mailManagement.preheader")}</span><input className="input mt-2" value={preheader} onChange={(event) => setPreheader(event.target.value)} /></label>
              <RichTextEditor label={t("mailManagement.content")} value={bodyHtml} onChange={setBodyHtml} placeholder={t("mailManagement.bodyPlaceholder")} helpText={t("mailManagement.editorHelp")} toolbarLabels={{ bold: t("contactHelp.editor.bold"), italic: t("contactHelp.editor.italic"), bulletList: t("contactHelp.editor.bulletList"), numberedList: t("contactHelp.editor.numberedList") }} />
              <div><p className="text-sm font-bold text-slate-900">{t("mailManagement.parameters")}</p><div className="mt-2 flex flex-wrap gap-2">{editor.parameters.map((parameter) => <button key={parameter.key} type="button" className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800" title={parameter.descriptionNl} onClick={() => insertParameter(parameter.key)}>{`{{${parameter.key}}}`}</button>)}</div></div>
            </div>
            <div className="card p-5"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-slate-500" /><h3 className="font-bold text-slate-950">{t("mailManagement.version")}</h3></div><div className="mt-3 space-y-2">{currentVersions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-bold">{t("mailManagement.version")} {version.version} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase ${version.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{version.status === "PUBLISHED" ? t("mailManagement.published") : t("mailManagement.draft")}</span></p><p className="mt-1 text-xs text-slate-500">{version.changeNote || "-"}</p></div><div className="flex flex-wrap gap-2">{version.status === "DRAFT" && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void publish(version.id)}><Send className="h-4 w-4" />{t("mailManagement.publish")}</button>}<button type="button" className="btn-secondary" disabled={busy} onClick={() => void sendTest(version.id)}><Send className="h-4 w-4" />{t("mailManagement.test")}</button>{version.status === "PUBLISHED" && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void restore(version.id)}><RefreshCw className="h-4 w-4" />{t("mailManagement.restore")}</button>}</div></div>)}</div></div>
          </>}
        </section>
      </div>
    </div>
  );
}

function applyVersion(versions: TemplateVersion[], language: Language, setSubject: (value: string) => void, setPreheader: (value: string) => void, setBodyHtml: (value: string) => void) {
  const version = versions.filter((item) => item.language === language).sort((left, right) => right.version - left.version)[0];
  setSubject(version?.subject ?? "");
  setPreheader(version?.preheader ?? "");
  setBodyHtml(version?.bodyHtml ?? "");
}
