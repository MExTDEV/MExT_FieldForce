"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  Mail,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { EmptyState, PageHeader } from "@/components/ui";
import { translate } from "@/lib/i18n";

type MailTestSetting = {
  key: "MAIL_TEST";
  active: boolean;
  locked: boolean;
  recipient: string;
};

type MailSettings = {
  mailTest: MailTestSetting;
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    security: "none" | "starttls" | "tls";
    authType: "none" | "password";
    username: string;
    passwordConfigured: boolean;
    defaultFromEmail: string;
    defaultFromName: string;
    defaultReplyToEmail: string;
  };
  ready: boolean;
  missing: string[];
};

type MailSettingsResponse = {
  setting?: MailTestSetting;
  mailSettings?: MailSettings;
  error?: string;
  details?: string;
  requestId?: string;
  sent?: boolean;
  recipient?: string;
};

type ProfilePhotoSyncRun = {
  id: string;
  trigger: "NIGHTLY" | "MANUAL";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL_ERROR" | "ERROR" | "SKIPPED";
  startedByUserId?: string | null;
  startedAt?: string;
  finishedAt?: string;
  checkedUsers: number;
  updatedPhotos: number;
  unchangedPhotos: number;
  noPhotoUsers: number;
  skippedUsers: number;
  errorUsers: number;
  errorMessage?: string | null;
};

type ProfilePhotoSyncResponse = {
  run?: ProfilePhotoSyncRun;
  started?: boolean;
  error?: string;
  details?: string;
  requestId?: string;
};

type MailDraft = {
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecurity: "none" | "starttls" | "tls";
  smtpAuthType: "none" | "password";
  smtpUsername: string;
  smtpPassword: string;
  clearSmtpPassword: boolean;
  defaultFromEmail: string;
  defaultFromName: string;
  defaultReplyToEmail: string;
};

const productionConfirmation = "PRODUCTIE";

const emptyDraft: MailDraft = {
  smtpEnabled: false,
  smtpHost: "",
  smtpPort: "587",
  smtpSecurity: "starttls",
  smtpAuthType: "password",
  smtpUsername: "",
  smtpPassword: "",
  clearSmtpPassword: false,
  defaultFromEmail: "",
  defaultFromName: "MExT FieldForce",
  defaultReplyToEmail: "",
};

export function SettingsManagement() {
  const { user, language } = useSession();
  const [setting, setSetting] = useState<MailTestSetting>();
  const [mailSettings, setMailSettings] = useState<MailSettings>();
  const [mailDraft, setMailDraft] = useState<MailDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [recipientDraft, setRecipientDraft] = useState("");
  const [photoRun, setPhotoRun] = useState<ProfilePhotoSyncRun>();
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoStarting, setPhotoStarting] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const loadRequestId = useRef(0);
  const mutationInFlight = useRef(false);
  const busy = saving || sendingTest;
  const photoBusy = photoStarting || photoRun?.status === "QUEUED" || photoRun?.status === "RUNNING";
  const hasUnsavedMailChanges = hasUnsavedMailSettings(
    mailSettings,
    mailDraft,
    recipientDraft
  );

  const applyPayload = useCallback((payload: MailSettingsResponse) => {
    if (payload.mailSettings) {
      setMailSettings(payload.mailSettings);
      setSetting(payload.mailSettings.mailTest);
      setRecipientDraft(payload.mailSettings.mailTest.recipient);
      setMailDraft({
        smtpEnabled: payload.mailSettings.smtp.enabled,
        smtpHost: payload.mailSettings.smtp.host,
        smtpPort: String(payload.mailSettings.smtp.port || 587),
        smtpSecurity: payload.mailSettings.smtp.security,
        smtpAuthType: payload.mailSettings.smtp.authType,
        smtpUsername: payload.mailSettings.smtp.username,
        smtpPassword: "",
        clearSmtpPassword: false,
        defaultFromEmail: payload.mailSettings.smtp.defaultFromEmail,
        defaultFromName: payload.mailSettings.smtp.defaultFromName || "MExT FieldForce",
        defaultReplyToEmail: payload.mailSettings.smtp.defaultReplyToEmail,
      });
      return;
    }
    if (payload.setting) {
      setSetting(payload.setting);
      setRecipientDraft(payload.setting.recipient);
    }
  }, []);

  const load = useCallback(async () => {
    if (!user.id) {
      setLoading(false);
      return;
    }
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const response = await fetch(
        `/api/management/settings/mail-test?actorId=${encodeURIComponent(user.id)}`,
        { cache: "no-store" }
      );
      const payload = await readMailSettingsResponse(response);
      if (requestId !== loadRequestId.current) return;
      if (!response.ok || (!payload.setting && !payload.mailSettings)) {
        throw new Error(apiErrorMessage(payload, translate(language, "settings.mailTest.loadError")));
      }
      applyPayload(payload);
    } catch (cause) {
      if (requestId !== loadRequestId.current) return;
      setLoadError(cause instanceof Error ? cause.message : translate(language, "settings.mailTest.loadError"));
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [applyPayload, language, user.id]);

  const loadPhotoSync = useCallback(async () => {
    if (!user.id) return;
    setPhotoLoading(true);
    setPhotoError(undefined);
    try {
      const response = await fetch(
        `/api/management/settings/profile-photos?actorId=${encodeURIComponent(user.id)}`,
        { cache: "no-store" }
      );
      const payload = await readProfilePhotoSyncResponse(response);
      if (!response.ok) throw new Error(apiErrorMessage(payload, translate(language, "settings.microsoftPhoto.loadError")));
      setPhotoRun(payload.run);
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : translate(language, "settings.microsoftPhoto.loadError"));
    } finally {
      setPhotoLoading(false);
    }
  }, [language, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPhotoSync();
  }, [loadPhotoSync]);

  useEffect(() => {
    if (!photoBusy) return;
    const handle = window.setInterval(() => void loadPhotoSync(), 3000);
    return () => window.clearInterval(handle);
  }, [loadPhotoSync, photoBusy]);

  async function updateMailTest(active: boolean, productionWord?: string, recipientOverride?: string) {
    if (!setting || mutationInFlight.current) return;
    const recipient = (recipientOverride ?? recipientDraft).trim();
    if (!isValidEmail(recipient)) {
      setSaveError(translate(language, "settings.mailTest.invalidRecipient"));
      return;
    }
    mutationInFlight.current = true;
    setSaving(true);
    setSaveError(undefined);
    setNotice(undefined);
    try {
      const response = await fetch("/api/management/settings/mail-test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: user.id,
          active,
          recipient,
          ...(productionWord ? { confirmation: productionWord } : {}),
        }),
      });
      const payload = await readMailSettingsResponse(response);
      if (!response.ok || (!payload.setting && !payload.mailSettings)) {
        throw new Error(apiErrorMessage(payload, translate(language, "settings.mailTest.saveError")));
      }
      applyPayload(payload);
      setNotice(
        translate(
          language,
          active === setting.active
            ? "settings.mailTest.savedRecipient"
            : active
              ? "settings.mailTest.savedActive"
              : "settings.mailTest.savedInactive"
        )
      );
      if (!active) closeConfirmation();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : translate(language, "settings.mailTest.saveError"));
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  async function saveMailSettings() {
    if (!setting || mutationInFlight.current) return;
    const recipient = recipientDraft.trim();
    if (!isValidEmail(recipient)) {
      setSaveError(translate(language, "settings.mailTest.invalidRecipient"));
      return;
    }
    const port = Number(mailDraft.smtpPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setSaveError(translate(language, "settings.mail.smtpPortInvalid"));
      return;
    }
    mutationInFlight.current = true;
    setSaving(true);
    setSaveError(undefined);
    setNotice(undefined);
    try {
      const response = await fetch("/api/management/settings/mail-test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: user.id,
          mailTestActive: setting.active,
          mailTestRecipient: recipient,
          smtpEnabled: mailDraft.smtpEnabled,
          smtpHost: mailDraft.smtpHost,
          smtpPort: port,
          smtpSecurity: mailDraft.smtpSecurity,
          smtpAuthType: mailDraft.smtpAuthType,
          smtpUsername: mailDraft.smtpUsername,
          smtpPassword: mailDraft.smtpPassword || undefined,
          clearSmtpPassword: mailDraft.clearSmtpPassword,
          defaultFromEmail: mailDraft.defaultFromEmail,
          defaultFromName: mailDraft.defaultFromName,
          defaultReplyToEmail: mailDraft.defaultReplyToEmail,
        }),
      });
      const payload = await readMailSettingsResponse(response);
      if (!response.ok || !payload.mailSettings) {
        throw new Error(apiErrorMessage(payload, translate(language, "settings.mail.saveError")));
      }
      applyPayload(payload);
      setNotice(translate(language, "settings.mail.saved"));
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : translate(language, "settings.mail.saveError"));
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  }

  async function sendTestMail() {
    if (
      !setting ||
      !mailSettings?.ready ||
      hasUnsavedMailChanges ||
      mutationInFlight.current
    ) {
      return;
    }
    mutationInFlight.current = true;
    setSendingTest(true);
    setSaveError(undefined);
    setNotice(undefined);
    try {
      const response = await fetch("/api/management/settings/mail-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user.id }),
      });
      const payload = await readMailSettingsResponse(response);
      if (!response.ok || !payload.sent) {
        throw new Error(
          apiErrorMessage(
            payload,
            translate(language, "settings.mailTest.sendTestError")
          )
        );
      }
      setNotice(translate(language, "settings.mailTest.sentTest"));
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : translate(language, "settings.mailTest.sendTestError")
      );
    } finally {
      mutationInFlight.current = false;
      setSendingTest(false);
    }
  }

  async function startPhotoSync() {
    if (!user.id || photoBusy) return;
    setPhotoStarting(true);
    setPhotoError(undefined);
    setNotice(undefined);
    try {
      const response = await fetch("/api/management/settings/profile-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user.id }),
      });
      const payload = await readProfilePhotoSyncResponse(response);
      if (!response.ok || !payload.run) {
        throw new Error(apiErrorMessage(payload, translate(language, "settings.microsoftPhoto.startError")));
      }
      setPhotoRun(payload.run);
      if (!payload.started) {
        setPhotoError(translate(language, "settings.microsoftPhoto.alreadyRunning"));
      }
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : translate(language, "settings.microsoftPhoto.startError"));
    } finally {
      setPhotoStarting(false);
    }
  }

  function requestToggle() {
    if (!setting || setting.locked || busy) return;
    setSaveError(undefined);
    setNotice(undefined);
    if (setting.active) {
      setConfirmation("");
      setConfirmOpen(true);
      return;
    }
    void updateMailTest(true);
  }

  function closeConfirmation() {
    setConfirmOpen(false);
    setConfirmation("");
    setSaveError(undefined);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={translate(language, "settings.eyebrow")}
        title={translate(language, "settings.title")}
        description={translate(language, "settings.description")}
      />

      {loading && !setting ? (
        <EmptyState
          title={translate(language, "settings.mailTest.loadingTitle")}
          description={translate(language, "settings.mailTest.loadingDescription")}
        />
      ) : loadError && !setting ? (
        <section className="card p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-rose-800">{translate(language, "settings.mailTest.unavailable")}</p>
              <p className="mt-1 text-sm text-rose-700">{loadError}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void load()}>
              <LoaderCircle className="h-4 w-4" />
              {translate(language, "settings.mailTest.retry")}
            </button>
          </div>
        </section>
      ) : setting ? (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">{translate(language, "settings.mail.title")}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{translate(language, "settings.mail.description")}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px] sm:p-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-950">{translate(language, "settings.mail.smtpTitle")}</h3>
                    <p className="mt-1 text-sm text-slate-500">{translate(language, "settings.mail.smtpDescription")}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={mailDraft.smtpEnabled}
                      onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpEnabled: event.target.checked }))}
                      disabled={busy}
                      className="h-4 w-4 rounded border-slate-300 text-brand-700"
                    />
                    {translate(language, "settings.mail.smtpEnabled")}
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label={translate(language, "settings.mail.smtpHost")}>
                    <input className="field" value={mailDraft.smtpHost} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpHost: event.target.value }))} disabled={busy} />
                  </Field>
                  <Field label={translate(language, "settings.mail.smtpPort")}>
                    <input className="field" type="number" min={1} max={65535} value={mailDraft.smtpPort} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpPort: event.target.value }))} disabled={busy} />
                  </Field>
                  <Field label={translate(language, "settings.mail.smtpSecurity")}>
                    <select className="field" value={mailDraft.smtpSecurity} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpSecurity: event.target.value as MailDraft["smtpSecurity"] }))} disabled={busy}>
                      <option value="starttls">STARTTLS</option>
                      <option value="tls">TLS/SSL</option>
                      <option value="none">Geen</option>
                    </select>
                  </Field>
                  <Field label={translate(language, "settings.mail.smtpAuthType")}>
                    <select className="field" value={mailDraft.smtpAuthType} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpAuthType: event.target.value as MailDraft["smtpAuthType"] }))} disabled={busy}>
                      <option value="password">{translate(language, "settings.mail.smtpAuthPassword")}</option>
                      <option value="none">{translate(language, "settings.mail.smtpAuthNone")}</option>
                    </select>
                  </Field>
                  <Field label={translate(language, "settings.mail.smtpUsername")}>
                    <input className="field" value={mailDraft.smtpUsername} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpUsername: event.target.value }))} disabled={busy || mailDraft.smtpAuthType === "none"} autoComplete="off" />
                  </Field>
                  <Field label={translate(language, "settings.mail.smtpPassword")}>
                    <input className="field" type="password" value={mailDraft.smtpPassword} onChange={(event) => setMailDraft((draft) => ({ ...draft, smtpPassword: event.target.value, clearSmtpPassword: false }))} disabled={busy || mailDraft.smtpAuthType === "none"} autoComplete="new-password" placeholder={mailSettings?.smtp.passwordConfigured ? translate(language, "settings.mail.passwordConfigured") : ""} />
                  </Field>
                  <Field label={translate(language, "settings.mail.defaultFromEmail")}>
                    <input className="field" type="email" value={mailDraft.defaultFromEmail} onChange={(event) => setMailDraft((draft) => ({ ...draft, defaultFromEmail: event.target.value }))} disabled={busy} />
                  </Field>
                  <Field label={translate(language, "settings.mail.defaultFromName")}>
                    <input className="field" value={mailDraft.defaultFromName} onChange={(event) => setMailDraft((draft) => ({ ...draft, defaultFromName: event.target.value }))} disabled={busy} />
                  </Field>
                  <Field label={translate(language, "settings.mail.defaultReplyToEmail")}>
                    <input className="field" type="email" value={mailDraft.defaultReplyToEmail} onChange={(event) => setMailDraft((draft) => ({ ...draft, defaultReplyToEmail: event.target.value }))} disabled={busy} />
                  </Field>
                  <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={mailDraft.clearSmtpPassword}
                      onChange={(event) => setMailDraft((draft) => ({ ...draft, clearSmtpPassword: event.target.checked, smtpPassword: "" }))}
                      disabled={busy || !mailSettings?.smtp.passwordConfigured}
                      className="h-4 w-4 rounded border-slate-300 text-brand-700"
                    />
                    {translate(language, "settings.mail.clearPassword")}
                  </label>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-slate-500">{translate(language, "settings.mail.passwordHelp")}</p>
                  <button type="button" className="btn-primary justify-center" onClick={() => void saveMailSettings()} disabled={busy}>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {translate(language, "settings.mail.save")}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={`rounded-xl border p-4 ${setting.active ? "border-sky-100 bg-sky-50/70" : "border-amber-200 bg-amber-50/70"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${setting.active ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>
                      {setting.active ? <ShieldCheck className="h-5 w-5" /> : <CircleHelp className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-950">{translate(language, "settings.mailTest.title")}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{translate(language, "settings.mailTest.description")}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${setting.active ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>
                        {translate(language, setting.active ? "settings.mailTest.active" : "settings.mailTest.inactive")}
                      </span>
                      {setting.locked ? (
                        <p className="mt-2 text-xs font-semibold leading-5 text-sky-800">
                          {translate(language, "settings.mailTest.environmentLocked")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={setting.active}
                    aria-label={translate(language, "settings.mailTest.toggleLabel")}
                    disabled={busy || loading || setting.locked}
                    onClick={requestToggle}
                    className={`relative h-8 w-14 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${setting.active ? "bg-brand-700" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow-sm transition-transform ${setting.active ? "translate-x-7" : "translate-x-1"}`}>
                      {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-brand-700" />}
                    </span>
                  </button>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {translate(language, "settings.mailTest.recipient")}
                    <input
                      type="email"
                      value={recipientDraft}
                      onChange={(event) => {
                        setRecipientDraft(event.target.value);
                        setSaveError(undefined);
                        setNotice(undefined);
                      }}
                      disabled={busy || loading}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
                      placeholder="helpdesk@mext.be"
                      autoComplete="off"
                    />
                  </label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button type="button" className="btn-secondary justify-center" disabled={busy || recipientDraft.trim() === setting.recipient} onClick={() => void updateMailTest(setting.active)}>
                      {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {translate(language, "settings.mailTest.saveRecipient")}
                    </button>
                    <button
                      type="button"
                      className="btn-primary justify-center"
                      disabled={busy || !mailSettings?.ready || hasUnsavedMailChanges}
                      onClick={() => void sendTestMail()}
                      aria-describedby="mail-test-send-help"
                    >
                      {sendingTest ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {translate(
                        language,
                        sendingTest
                          ? "settings.mailTest.sendingTest"
                          : "settings.mailTest.sendTest"
                      )}
                    </button>
                  </div>
                  <p id="mail-test-send-help" className="mt-2 text-xs leading-5 text-slate-600">
                    {translate(
                      language,
                      mailSettings?.ready
                        ? "settings.mailTest.sendTestHelp"
                        : "settings.mailTest.notReadyForTest"
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{translate(language, "settings.mail.status")}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {mailSettings?.ready ? translate(language, "settings.mail.ready") : translate(language, "settings.mail.notReady")}
                </p>
                {mailSettings?.missing?.length ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">{mailSettings.missing.join(", ")}</p>
                ) : null}
              </div>
            </div>
          </div>

          {(notice || saveError) && (
            <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
              {notice && <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}</p>}
              {saveError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{saveError}</p>}
            </div>
          )}
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">{translate(language, "settings.microsoftPhoto.title")}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{translate(language, "settings.microsoftPhoto.description")}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px] sm:p-6">
          <div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label={translate(language, "settings.microsoftPhoto.lastStarted")} value={formatDateTime(photoRun?.startedAt, language)} />
              <Metric label={translate(language, "settings.microsoftPhoto.lastFinished")} value={formatDateTime(photoRun?.finishedAt, language)} />
              <Metric label={translate(language, "settings.microsoftPhoto.status")} value={photoRun ? translate(language, `settings.microsoftPhoto.status.${photoRun.status}`) : "-"} />
              <Metric label={translate(language, "settings.microsoftPhoto.checked")} value={String(photoRun?.checkedUsers ?? 0)} />
              <Metric label={translate(language, "settings.microsoftPhoto.updated")} value={String(photoRun?.updatedPhotos ?? 0)} />
              <Metric label={translate(language, "settings.microsoftPhoto.unchanged")} value={String(photoRun?.unchangedPhotos ?? 0)} />
              <Metric label={translate(language, "settings.microsoftPhoto.noPhoto")} value={String(photoRun?.noPhotoUsers ?? 0)} />
              <Metric label={translate(language, "settings.microsoftPhoto.skipped")} value={String(photoRun?.skippedUsers ?? 0)} />
              <Metric label={translate(language, "settings.microsoftPhoto.errors")} value={String(photoRun?.errorUsers ?? 0)} />
            </div>
            {photoError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{photoError}</p>}
            {photoRun?.status === "COMPLETED" && (
              <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                {translate(language, "settings.microsoftPhoto.completed")
                  .replace("{checked}", String(photoRun.checkedUsers))
                  .replace("{updated}", String(photoRun.updatedPhotos))
                  .replace("{noPhoto}", String(photoRun.noPhotoUsers))
                  .replace("{errors}", String(photoRun.errorUsers))}
              </p>
            )}
            {photoRun?.status === "PARTIAL_ERROR" && (
              <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                {translate(language, "settings.microsoftPhoto.partial")
                  .replace("{checked}", String(photoRun.checkedUsers))
                  .replace("{updated}", String(photoRun.updatedPhotos))
                  .replace("{noPhoto}", String(photoRun.noPhotoUsers))
                  .replace("{errors}", String(photoRun.errorUsers))}
              </p>
            )}
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-600">
              {photoBusy ? translate(language, "settings.microsoftPhoto.running") : translate(language, "settings.microsoftPhoto.ready")}
            </p>
            <button type="button" className="btn-primary justify-center" disabled={photoBusy || photoLoading} onClick={() => void startPhotoSync()}>
              {photoBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {translate(language, photoBusy ? "settings.microsoftPhoto.runningButton" : "settings.microsoftPhoto.syncButton")}
            </button>
          </div>
        </div>
      </section>

      {confirmOpen && !setting?.locked && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-950">{translate(language, "settings.mailTest.confirmTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{translate(language, "settings.mailTest.confirmDescription")}</p>
            <label className="mt-5 block text-sm font-semibold text-slate-800">
              {translate(language, "settings.mailTest.confirmInstruction")}
              <input autoFocus type="text" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold tracking-wide text-slate-950 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100" placeholder={productionConfirmation} autoComplete="off" />
            </label>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={closeConfirmation} disabled={busy}>{translate(language, "settings.mailTest.cancel")}</button>
              <button type="button" className="btn-primary bg-amber-600 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={confirmation !== productionConfirmation || busy} onClick={() => void updateMailTest(false, confirmation)}>
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {translate(language, "settings.mailTest.confirmAction")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800">{value || "-"}</p>
    </div>
  );
}

function hasUnsavedMailSettings(
  settings: MailSettings | undefined,
  draft: MailDraft,
  recipient: string
) {
  if (!settings) return true;
  return (
    recipient.trim() !== settings.mailTest.recipient ||
    draft.smtpEnabled !== settings.smtp.enabled ||
    draft.smtpHost.trim() !== settings.smtp.host ||
    Number(draft.smtpPort) !== settings.smtp.port ||
    draft.smtpSecurity !== settings.smtp.security ||
    draft.smtpAuthType !== settings.smtp.authType ||
    draft.smtpUsername.trim() !== settings.smtp.username ||
    Boolean(draft.smtpPassword.trim()) ||
    draft.clearSmtpPassword ||
    draft.defaultFromEmail.trim() !== settings.smtp.defaultFromEmail ||
    draft.defaultFromName.trim() !== settings.smtp.defaultFromName ||
    draft.defaultReplyToEmail.trim() !== settings.smtp.defaultReplyToEmail
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function apiErrorMessage(payload: { details?: string; error?: string; requestId?: string }, fallback: string) {
  const requestLabel = payload.requestId ? ` (${payload.requestId})` : "";
  return `${payload.details ?? payload.error ?? fallback}${requestLabel}`;
}

function formatDateTime(value: string | undefined, language: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(language, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readMailSettingsResponse(response: Response): Promise<MailSettingsResponse> {
  try {
    return (await response.json()) as MailSettingsResponse;
  } catch {
    return {};
  }
}

async function readProfilePhotoSyncResponse(response: Response): Promise<ProfilePhotoSyncResponse> {
  try {
    return (await response.json()) as ProfilePhotoSyncResponse;
  } catch {
    return {};
  }
}
