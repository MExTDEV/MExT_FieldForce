"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Save, Send } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { RichTextEditor } from "@/components/rich-text-editor";
import { translate } from "@/lib/i18n";
import type { Country, Language } from "@/lib/types";

type FooterVersion = { id: string; language: Language; version: number; status: "DRAFT" | "PUBLISHED"; bodyHtml: string; changeNote: string | null };
type Branding = { country: Country; senderName: string | null; replyToEmail: string | null; supportEmail: string | null; supportPhone: string | null; logoAsset: { publicUrl: string } | null; footerVersions: FooterVersion[] };

export function MailBrandingManagement() {
  const { user } = useSession();
  const t = useMemo(() => (key: Parameters<typeof translate>[1]) => translate(user.language, key), [user.language]);
  const [profiles, setProfiles] = useState<Branding[]>([]);
  const [country, setCountry] = useState<Country>(user.country);
  const [footerLanguage, setFooterLanguage] = useState<Language>(user.language);
  const [senderName, setSenderName] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const response = await fetch(`/api/management/mail/branding?actorId=${encodeURIComponent(user.id)}`, { cache: "no-store" });
    const payload = await response.json() as { branding?: Branding[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
    setProfiles(payload.branding ?? []);
  }, [t, user.id]);

  useEffect(() => { void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("mailManagement.loadError"))); }, [load, t]);

  useEffect(() => {
    const profile = profiles.find((item) => item.country === country);
    const footer = profile?.footerVersions.filter((item) => item.language === footerLanguage).sort((left, right) => right.version - left.version)[0];
    setSenderName(profile?.senderName ?? ""); setReplyToEmail(profile?.replyToEmail ?? ""); setSupportEmail(profile?.supportEmail ?? ""); setSupportPhone(profile?.supportPhone ?? ""); setLogoUrl(profile?.logoAsset?.publicUrl ?? ""); setFooterHtml(footer?.bodyHtml ?? "");
  }, [country, footerLanguage, profiles]);

  const currentProfile = profiles.find((item) => item.country === country);
  const draft = currentProfile?.footerVersions.filter((item) => item.language === footerLanguage && item.status === "DRAFT").sort((left, right) => right.version - left.version)[0];

  async function save() {
    setBusy(true); setNotice(undefined); setError(undefined);
    try {
      const response = await fetch("/api/management/mail/branding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: user.id, action: "save", country, footerLanguage, senderName, replyToEmail, supportEmail, supportPhone, logoUrl, footerHtml }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
      await load(); setNotice(t("mailManagement.brandingSaved"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  async function publish(versionId: string) {
    setBusy(true); setNotice(undefined); setError(undefined);
    try {
      const response = await fetch("/api/management/mail/branding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorId: user.id, action: "publish", versionId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("mailManagement.loadError"));
      await load(); setNotice(t("mailManagement.brandingPublished"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("mailManagement.loadError")); }
    finally { setBusy(false); }
  }

  return <section className="card space-y-5 p-5"><div><h2 className="text-xl font-bold text-slate-950">{t("mailManagement.brandingTitle")}</h2><p className="mt-1 text-sm text-slate-500">{t("mailManagement.brandingDescription")}</p></div>{notice && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><Check className="h-4 w-4" />{notice}</div>}{error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div>}<div className="grid gap-4 md:grid-cols-2"><label><span className="text-sm font-bold">{t("mailManagement.country")}</span><select className="input mt-2" value={country} onChange={(event) => setCountry(event.target.value as Country)}>{["BE", "NL", "DE"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="text-sm font-bold">{t("mailManagement.footerLanguage")}</span><select className="input mt-2" value={footerLanguage} onChange={(event) => setFooterLanguage(event.target.value as Language)}><option value="nl">Nederlands</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label><label><span className="text-sm font-bold">{t("mailManagement.senderName")}</span><input className="input mt-2" value={senderName} onChange={(event) => setSenderName(event.target.value)} /></label><label><span className="text-sm font-bold">{t("mailManagement.replyTo")}</span><input className="input mt-2" value={replyToEmail} onChange={(event) => setReplyToEmail(event.target.value)} /></label><label><span className="text-sm font-bold">{t("mailManagement.supportEmail")}</span><input className="input mt-2" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} /></label><label><span className="text-sm font-bold">{t("mailManagement.supportPhone")}</span><input className="input mt-2" value={supportPhone} onChange={(event) => setSupportPhone(event.target.value)} /></label><label className="md:col-span-2"><span className="text-sm font-bold">{t("mailManagement.logoUrl")}</span><input className="input mt-2" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://..." /></label></div><RichTextEditor label={t("mailManagement.footer")} value={footerHtml} onChange={setFooterHtml} placeholder={t("mailManagement.footerPlaceholder")} helpText={t("mailManagement.footerHelp")} toolbarLabels={{ bold: t("contactHelp.editor.bold"), italic: t("contactHelp.editor.italic"), bulletList: t("contactHelp.editor.bulletList"), numberedList: t("contactHelp.editor.numberedList") }} /><div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}><Save className="h-4 w-4" />{t("mailManagement.save")}</button>{draft && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void publish(draft.id)}><Send className="h-4 w-4" />{t("mailManagement.publishFooter")}</button>}</div></section>;
}
