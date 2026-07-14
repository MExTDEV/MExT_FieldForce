"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  FileDown,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useSession } from "@/components/session-provider";
import { useRepresentatives } from "@/components/representatives-provider";
import { useWorkflow } from "@/components/workflow-provider";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import {
  ActionPointEditor,
  toEditableActionPoint,
  type EditableActionPoint,
} from "@/components/action-point-editor";
import { Avatar, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { canAccessRepresentative, canCreateIntervention } from "@/lib/permissions";
import {
  contactMomentFilterOptions,
  filterContactMoments,
  toLocalDateKey,
  type ContactMomentOverviewFilter,
} from "@/lib/contact-moment-filters";
import { translate, type TranslationKey } from "@/lib/i18n";
import {
  contactMomentPhotoAccept,
  maxContactMomentPhotos,
  maxContactMomentPhotoSize,
} from "@/lib/contact-moment-photo-metadata";
import { isBlankRichText, sanitizeRichText } from "@/lib/rich-text";
import { exportContactMomentPdf, type ContactMomentPdfPhoto } from "@/lib/contact-moment-pdf";
import type {
  ContactMoment,
  ContactMomentPhoto,
  FollowUpType,
  HelpRequest,
  Language,
  Representative,
} from "@/lib/types";

const themeOptions = [
  { value: "KPI-opvolging", labelKey: "contactHelp.theme.kpiFollowUp" },
  { value: "Behoefteanalyse", labelKey: "contactHelp.theme.needsAnalysis" },
  { value: "Demonstratie", labelKey: "contactHelp.theme.demonstration" },
  { value: "Prijsverdediging", labelKey: "contactHelp.theme.priceDefense" },
  { value: "Afsluiten", labelKey: "contactHelp.theme.closing" },
  { value: "Planning en organisatie", labelKey: "contactHelp.theme.planning" },
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: TranslationKey;
}>;

const followUpLabelKeys: Record<FollowUpType, TranslationKey> = {
  begeleiding: "contactHelp.followUp.coaching",
  contactmoment: "contactHelp.followUp.contactMoment",
  retraining: "contactHelp.followUp.retraining",
  sales_training: "contactHelp.followUp.salesTraining",
  enkel_opvolging: "contactHelp.followUp.followUpOnly",
  geen_actie: "contactHelp.followUp.noAction",
};

type HelpRequestManagerAction = FollowUpType | "respons" | "";

const contactFilterLabelKeys: Record<ContactMomentOverviewFilter, TranslationKey> = {
  all: "contactHelp.contact.filter.all",
  today: "contactHelp.contact.filter.today",
  future: "contactHelp.contact.filter.future",
  draftReports: "contactHelp.contact.filter.draftReports",
  shared: "contactHelp.contact.filter.shared",
  cancelled: "contactHelp.contact.filter.cancelled",
  notCompleted: "contactHelp.contact.filter.notCompleted",
};

function makeT(language: Language) {
  return (key: TranslationKey) => translate(language, key);
}

function localeFor(language: Language) {
  return language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
}

function statusLabel(language: Language, status: string) {
  const key = `status.${status}` as TranslationKey;
  const label = translate(language, key);
  return label === key ? status.replaceAll("_", " ") : label;
}

function formatDate(value: string, language: Language) {
  return new Date(value).toLocaleDateString(localeFor(language));
}

function formatDateTime(value: string, language: Language) {
  return new Date(value).toLocaleString(localeFor(language));
}

function formatPlannedDate(value: string, language: Language) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(localeFor(language));
}

function representativeName(representative: Representative | undefined, fallback: string) {
  return representative ? `${representative.firstName} ${representative.lastName}` : fallback;
}

function translatedThemeOptions(t: (key: TranslationKey) => string) {
  return themeOptions.map((option) => ({ value: option.value, label: t(option.labelKey) }));
}

type ThemeOption = ReturnType<typeof translatedThemeOptions>[number];

export function ContactMomentsPage({ id, isNew }: { id?: string; isNew?: boolean }) {
  const { user, language } = useSession();
  const t = makeT(language);
  const workflow = useWorkflow();
  const contacts = workflow.visibleContactMoments(user);
  const [activeFilter, setActiveFilter] = useState<ContactMomentOverviewFilter>("all");
  const todayKey = toLocalDateKey();
  const filteredContacts = filterContactMoments(contacts, activeFilter, todayKey);
  const filterCounts = contactMomentFilterOptions.map((option) => ({
    ...option,
    label: t(contactFilterLabelKeys[option.value]),
    count: filterContactMoments(contacts, option.value, todayKey).length,
  }));
  const openContacts = [...filteredContacts]
    .filter((contact) => !isFinalContactMoment(contact))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const closedContacts = [...filteredContacts]
    .filter(isFinalContactMoment)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (isNew) return <NewContactMoment />;
  if (id) {
    const contact = workflow.state.contactMoments.find((item) => item.id === id);
    if (!contact || !contacts.some((item) => item.id === id)) {
      return <EmptyState title={t("contactHelp.contact.unavailableTitle")} description={t("contactHelp.contact.unavailableDescription")} />;
    }
    return <ContactMomentDetail contact={contact} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("contactHelp.contact.eyebrow")}
        title={t("contactHelp.contact.pageTitle")}
        description={t("contactHelp.contact.pageDescription")}
        actions={canCreateIntervention(user) ? (
          <Link href="/contactmomenten/nieuw" className="btn-primary"><Plus className="h-4 w-4" /> {t("contactHelp.contact.newAction")}</Link>
        ) : undefined}
      />
      <ContactMomentFilters
        activeFilter={activeFilter}
        options={filterCounts}
        onChange={setActiveFilter}
      />
      <ContactMomentSection
        eyebrow={t("contactHelp.contact.sectionOpenEyebrow")}
        title={t("contactHelp.contact.sectionOpenTitle")}
        description={t("contactHelp.contact.sectionOpenDescription")}
        contacts={openContacts}
        emptyMessage={t("contactHelp.contact.sectionOpenEmpty")}
        openLabel={t("contactHelp.common.open")}
        language={language}
      />
      <ContactMomentSection
        eyebrow={t("contactHelp.contact.sectionClosedEyebrow")}
        title={t("contactHelp.contact.sectionClosedTitle")}
        description={t("contactHelp.contact.sectionClosedDescription")}
        contacts={closedContacts}
        emptyMessage={t("contactHelp.contact.sectionClosedEmpty")}
        openLabel={t("contactHelp.common.open")}
        language={language}
        historical
      />
    </div>
  );
}

function ContactMomentFilters({
  activeFilter,
  options,
  onChange,
}: {
  activeFilter: ContactMomentOverviewFilter;
  options: Array<{ value: ContactMomentOverviewFilter; label: string; count: number }>;
  onChange: (value: ContactMomentOverviewFilter) => void;
}) {
  return (
    <section className="card p-4">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === activeFilter;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                active
                  ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              <span>{option.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ContactMomentSection({
  eyebrow,
  title,
  description,
  contacts,
  emptyMessage,
  openLabel,
  language,
  historical = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  contacts: ContactMoment[];
  emptyMessage: string;
  openLabel: string;
  language: Language;
  historical?: boolean;
}) {
  const { representatives } = useRepresentatives();

  return (
    <section className={`space-y-4 ${historical ? "border-t border-slate-200 pt-6" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">{eyebrow}</p>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${historical ? "bg-slate-100 text-slate-700" : "bg-brand-50 text-brand-700"}`}>
          {contacts.length}
        </span>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {contacts.map((contact) => {
            const representative = representatives.find((item) => item.id === contact.representativeId);
            return (
              <Link key={contact.id} href={`/contactmomenten/${contact.id}`} className="card group p-5 transition hover:border-brand-200">
                <div className="flex items-start gap-4">
                  <Avatar initials={representative?.initials ?? "VT"} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-950">{representative?.firstName} {representative?.lastName}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{contact.reason}</p>
                  </div>
                  <StatusBadge status={contact.status} />
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-400">{formatDate(contact.updatedAt, language)}</span>
                  <span className="text-sm font-semibold text-brand-700 group-hover:underline">{openLabel}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

type PendingContactPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

function PendingPhotoPicker({
  photos,
  busy,
  onAdd,
  onRemove,
  t,
}: {
  photos: PendingContactPhoto[];
  busy: boolean;
  onAdd: (files?: FileList | null) => void;
  onRemove: (id: string) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-950">{t("contactHelp.contact.photosTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("contactHelp.contact.photosPlanningDescription")}</p>
        </div>
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          <Plus className="h-4 w-4" />
          {busy ? t("contactHelp.contact.uploading") : t("contactHelp.contact.addPhotos")}
          <input
            type="file"
            accept={contactMomentPhotoAccept}
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              onAdd(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {t("contactHelp.contact.photoLimits")
          .replace("{count}", String(maxContactMomentPhotos))
          .replace("{size}", formatBytes(maxContactMomentPhotoSize))}
      </p>
      {photos.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          {t("contactHelp.contact.noPhotos")}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- Local pre-save object URLs are not compatible with Next image optimization. */}
              <img src={photo.previewUrl} alt={photo.file.name} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-700">{photo.file.name}</span>
                  <span className="text-[11px] text-slate-400">{formatBytes(photo.file.size)}</span>
                </span>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                  disabled={busy}
                  onClick={() => onRemove(photo.id)}
                  aria-label={t("contactHelp.contact.deletePhoto")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function NewContactMoment() {
  const { user, language } = useSession();
  const t = makeT(language);
  const { saveContactMomentAsync } = useWorkflow();
  const { representatives } = useRepresentatives();
  const [savedId, setSavedId] = useState<string>();
  const [createdWarning, setCreatedWarning] = useState<string>();
  const available = representatives.filter((item) => canAccessRepresentative(user, item));
  const firstAvailableRepresentativeId = available[0]?.id;
  const [form, setForm] = useState({
    representativeId: firstAvailableRepresentativeId ?? "",
    plannedDate: "",
    startTime: "",
    endTime: "",
    subject: "",
    contactType: "",
    location: "",
    internalNotes: "",
    notifyRepresentative: false,
    reason: "",
    reportedProblems: "",
    leaderThemes: [] as string[],
  });
  const [pendingPhotos, setPendingPhotos] = useState<PendingContactPhoto[]>([]);
  const pendingPhotosRef = useRef<PendingContactPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setForm((current) => {
      const representativeId =
        current.representativeId || firstAvailableRepresentativeId || "";
      return representativeId === current.representativeId
        ? current
        : { ...current, representativeId };
    });
  }, [firstAvailableRepresentativeId]);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => () => {
    pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  if (!canCreateIntervention(user)) {
    return <EmptyState title={t("contactHelp.common.noRightsTitle")} description={t("contactHelp.contact.noCreateRights")} />;
  }
  if (savedId) {
    return <SuccessCard title={t("contactHelp.contact.createdTitle")} description={createdWarning ?? t("contactHelp.contact.createdDescription")} href={`/contactmomenten/${savedId}`} linkLabel={t("contactHelp.contact.openContact")} />;
  }
  const valid = form.representativeId && form.plannedDate && form.startTime && form.endTime && form.endTime > form.startTime;
  const addPendingPhotos = (files?: FileList | null) => {
    if (!files?.length) return;
    setError(undefined);
    const nextFiles = Array.from(files);
    const availableSlots = maxContactMomentPhotos - pendingPhotos.length;
    if (nextFiles.length > availableSlots) {
      setError(t("contactHelp.contact.photoLimitExceeded"));
      return;
    }
    const invalid = nextFiles.find((file) => !contactMomentPhotoAccept.split(",").includes(file.type));
    if (invalid) {
      setError(t("contactHelp.contact.photoUnsupportedType"));
      return;
    }
    const tooLarge = nextFiles.find((file) => file.size > maxContactMomentPhotoSize);
    if (tooLarge) {
      setError(t("contactHelp.contact.photoTooLarge"));
      return;
    }
    setPendingPhotos((current) => [
      ...current,
      ...nextFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };
  const removePendingPhoto = (id: string) => {
    setPendingPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };
  const save = async () => {
    if (saving) return;
    if (!valid) {
      setError(t("contactHelp.contact.validationPlanning"));
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const contact = await saveContactMomentAsync({
        ...form,
        reason: form.subject.trim() || form.contactType.trim() || t("contactHelp.contact.defaultReason"),
        initiatorId: user.id,
      }, "gepland");
      if (pendingPhotos.length) {
        const formData = new FormData();
        pendingPhotos.forEach((photo) => formData.append("file", photo.file));
        const response = await fetch(
          `/api/workflows/contact-moments/${encodeURIComponent(contact.id)}/photos?actorId=${encodeURIComponent(user.id)}`,
          { method: "POST", body: formData }
        );
        const payload = await response.json() as { photos?: ContactMomentPhoto[]; error?: string };
        if (!response.ok) {
          setCreatedWarning(payload.error ?? t("contactHelp.contact.photoUploadPartialAfterCreate"));
        }
      }
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setSavedId(contact.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("contactHelp.contact.saveError"));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink href="/contactmomenten" label={t("contactHelp.contact.backToList")} />
      <PageHeader eyebrow={t("contactHelp.common.new")} title={t("contactHelp.contact.newTitle")} description={t("contactHelp.contact.newDescription")} />
      <div className="card space-y-6 p-5 sm:p-7">
        <RepresentativePicker label={t("contactHelp.common.representative")} available={available} value={form.representativeId} onChange={(representativeId) => setForm((current) => ({ ...current, representativeId }))} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label={t("contactHelp.field.date")} type="date" value={form.plannedDate} onChange={(plannedDate) => setForm((current) => ({ ...current, plannedDate }))} />
          <TextInput label={t("contactHelp.field.startTime")} type="time" value={form.startTime} onChange={(startTime) => setForm((current) => ({ ...current, startTime }))} />
          <TextInput label={t("contactHelp.field.endTime")} type="time" value={form.endTime} onChange={(endTime) => setForm((current) => ({ ...current, endTime }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label={t("contactHelp.field.subject")} value={form.subject} onChange={(subject) => setForm((current) => ({ ...current, subject }))} />
          <TextInput label={t("contactHelp.field.contactType")} value={form.contactType} onChange={(contactType) => setForm((current) => ({ ...current, contactType }))} />
          <TextInput label={t("contactHelp.field.location")} value={form.location} onChange={(location) => setForm((current) => ({ ...current, location }))} />
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <input className="mt-1" type="checkbox" checked={form.notifyRepresentative} onChange={(event) => setForm((current) => ({ ...current, notifyRepresentative: event.target.checked }))} />
          <span><strong className="text-slate-900">{t("contactHelp.contact.notifyLabel")}</strong><br />{t("contactHelp.contact.notifyDescription")}</span>
        </label>
        <TextArea label={t("contactHelp.field.internalNotes")} value={form.internalNotes} onChange={(internalNotes) => setForm((current) => ({ ...current, internalNotes }))} optional />
        <TextArea label={t("contactHelp.field.reportedProblems")} value={form.reportedProblems} onChange={(reportedProblems) => setForm((current) => ({ ...current, reportedProblems }))} optional />
        <TagPicker label={t("contactHelp.field.leaderThemes")} options={translatedThemeOptions(t)} value={form.leaderThemes} onChange={(leaderThemes) => setForm((current) => ({ ...current, leaderThemes }))} />
        <PendingPhotoPicker
          photos={pendingPhotos}
          busy={saving}
          onAdd={addPendingPhotos}
          onRemove={removePendingPhoto}
          t={t}
        />
        {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" disabled={!valid || saving} onClick={() => void save()} className="btn-primary"><Save className="h-4 w-4" /> {saving ? t("contactHelp.common.saving") : t("contactHelp.contact.save")}</button>
        </div>
      </div>
    </div>
  );
}

function ContactMomentDetail({ contact }: { contact: ContactMoment }) {
  const { user, language } = useSession();
  const t = makeT(language);
  const { saveContactMoment } = useWorkflow();
  const { representatives } = useRepresentatives();
  const representative = representatives.find((item) => item.id === contact.representativeId);
  const canManage = canCreateIntervention(user) && !isFinalContactMoment(contact);
  const [discussedThemes, setDiscussedThemes] = useState(contact.discussedThemes);
  const [reportHtml, setReportHtml] = useState(contact.reportHtml ?? contact.conclusion);
  const [actions, setActions] = useState<EditableActionPoint[]>(
    contact.actionPoints.map(toEditableActionPoint)
  );
  const [photos, setPhotos] = useState<ContactMomentPhoto[]>(contact.photos ?? []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>();
  const [failedPhotoIds, setFailedPhotoIds] = useState<string[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [closedReason, setClosedReason] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  if (saved) {
    return <SuccessCard title={t("contactHelp.contact.detailUpdatedTitle")} description={t("contactHelp.contact.detailUpdatedDescription")} href="/contactmomenten" linkLabel={t("contactHelp.contact.toList")} />;
  }

  const updateStatus = (status: ContactMoment["status"]) => {
    setError(undefined);
    try {
      saveContactMoment({
        id: contact.id,
        representativeId: contact.representativeId,
        initiatorId: contact.ownerId,
        plannedDate: contact.plannedDate,
        startTime: contact.startTime,
        endTime: contact.endTime,
        notifyRepresentative: contact.notifyRepresentative,
        subject: contact.subject,
        contactType: contact.contactType,
        location: contact.location,
        internalNotes: contact.internalNotes,
        reason: contact.reason,
        reportedProblems: contact.reportedProblems,
        leaderThemes: contact.leaderThemes,
        representativeKpis: contact.representativeKpis,
        representativeThemes: contact.representativeThemes,
        discussedThemes,
        conclusion: reportHtml,
        reportHtml,
        actionPoints: actions,
        photos,
        closedReason,
        sourceHelpRequestId: contact.sourceHelpRequestId,
      }, status);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("contactHelp.contact.saveError"));
    }
  };
  const readOnly = isFinalContactMoment(contact) || !canManage;
  const photoBaseUrl = `/api/workflows/contact-moments/${encodeURIComponent(contact.id)}/photos`;
  const actorQuery = `actorId=${encodeURIComponent(user.id)}`;
  const uploadPhotos = async (files?: FileList | null) => {
    if (!files?.length || photoBusy) return;
    setPhotoBusy(true);
    setError(undefined);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("file", file));
      const response = await fetch(`${photoBaseUrl}?${actorQuery}`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json() as { photos?: ContactMomentPhoto[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("contactHelp.contact.photoUploadError"));
      setPhotos(payload.photos ?? []);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : t("contactHelp.contact.photoUploadError"));
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId);
  const deletePhoto = async (photoId: string) => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`${photoBaseUrl}/${encodeURIComponent(photoId)}?${actorQuery}`, {
        method: "DELETE",
      });
      const payload = await response.json() as { photos?: ContactMomentPhoto[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("contactHelp.contact.photoDeleteError"));
      setPhotos(payload.photos ?? []);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : t("contactHelp.contact.photoDeleteError"));
    } finally {
      setPhotoBusy(false);
    }
  };
  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setError(undefined);
    try {
      const pdfPhotos = await Promise.all(photos.map(async (photo): Promise<ContactMomentPdfPhoto> => {
        try {
          const response = await fetch(`${photoBaseUrl}/${encodeURIComponent(photo.id)}?${actorQuery}`);
          if (!response.ok) throw new Error("photo");
          return { ...photo, dataUrl: await blobToDataUrl(await response.blob()) };
        } catch {
          return photo;
        }
      }));
      await exportContactMomentPdf({
        contact: { ...contact, photos },
        representative,
        language,
        photos: pdfPhotos,
      });
    } catch {
      setError(t("contactHelp.contact.pdfError"));
    } finally {
      setPdfBusy(false);
    }
  };
  const details = [
    contact.plannedDate ? { label: t("contactHelp.field.date"), value: formatPlannedDate(contact.plannedDate, language) } : undefined,
    contact.startTime || contact.endTime ? { label: t("contactHelp.field.time"), value: `${contact.startTime ?? ""}${contact.endTime ? ` - ${contact.endTime}` : ""}` } : undefined,
    contact.subject ? { label: t("contactHelp.field.subject"), value: contact.subject } : undefined,
    contact.contactType ? { label: t("contactHelp.field.type"), value: contact.contactType } : undefined,
    contact.location ? { label: t("contactHelp.field.location"), value: contact.location } : undefined,
    contact.notifyRepresentative ? { label: t("contactHelp.field.notifiedInAdvance"), value: t("contactHelp.common.yes") } : undefined,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink href="/contactmomenten" label={t("contactHelp.contact.backToList")} />
      <PageHeader
        eyebrow={t("contactHelp.contact.singleEyebrow")}
        title={representativeName(representative, t("contactHelp.common.representative"))}
        description={contact.reason}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {isFinalContactMoment(contact) && (
              <button type="button" className="btn-secondary" disabled={pdfBusy} onClick={() => void downloadPdf()}>
                <FileDown className="h-4 w-4" />
                {pdfBusy ? t("contactHelp.contact.pdfBusy") : t("contactHelp.contact.pdfDownload")}
              </button>
            )}
            <StatusBadge status={contact.status} />
          </div>
        )}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="font-bold text-slate-950">{t("contactHelp.contact.basicData")}</h2>
          {details.map((item) => <InfoBlock key={item.label} label={item.label} value={item.value} />)}
          <InfoBlock label={t("contactHelp.field.employee")} value={representativeName(representative, t("contactHelp.common.representative"))} />
          {contact.reportedProblems && <InfoBlock label={t("contactHelp.field.reportedProblems")} value={contact.reportedProblems} />}
          {contact.leaderThemes.length > 0 && <InfoBlock label={t("contactHelp.field.preparedThemes")} value={contact.leaderThemes.join(", ")} />}
          {contact.internalNotes && canManage && <InfoBlock label={t("contactHelp.field.internalNote")} value={contact.internalNotes} />}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="font-bold text-slate-950">{t("contactHelp.contact.statusHistory")}</h2>
          <InfoBlock label={t("contactHelp.field.status")} value={statusLabel(language, contact.status)} />
          {contact.sharedAt && <InfoBlock label={t("contactHelp.field.sharedAt")} value={formatDateTime(contact.sharedAt, language)} />}
          {contact.closedReason && <InfoBlock label={t("contactHelp.field.closedReason")} value={contact.closedReason} />}
        </section>
      </div>

      {canManage && contact.status === "gepland" && (
        <button type="button" onClick={() => updateStatus("in_uitvoering")} className="btn-primary">
          <Play className="h-4 w-4" /> {t("contactHelp.contact.start")}
        </button>
      )}

      {(contact.status === "in_uitvoering" || contact.status === "afgesloten" || contact.status === "geannuleerd" || contact.status === "niet_uitgevoerd") && (
        <section className="card space-y-6 p-5 sm:p-7">
          <h2 className="text-lg font-bold text-slate-950">{t("contactHelp.field.report")}</h2>
          {readOnly ? (
            <RichTextRenderer value={contact.reportHtml ?? contact.conclusion} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700" />
          ) : (
            <>
              <TagPicker label={t("contactHelp.field.discussedThemes")} options={translatedThemeOptions(t)} value={discussedThemes} onChange={setDiscussedThemes} />
              <RichTextArea label={t("contactHelp.field.report")} value={reportHtml} onChange={setReportHtml} />
              <ActionPointEditor actions={actions} onChange={setActions} />
              {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t("contactHelp.contact.shareLockWarning")}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={isBlankRichText(reportHtml)} onClick={() => updateStatus("afgesloten")} className="btn-primary">
                  <CheckCircle2 className="h-4 w-4" /> {t("contactHelp.contact.share")}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {(photos.length > 0 || canManage) && (
        <section className="card space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-brand-700" />
                <h2 className="text-lg font-bold text-slate-950">{t("contactHelp.contact.photosTitle")}</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">{t("contactHelp.contact.photosDescription")}</p>
            </div>
            {canManage && (
              <label className={`btn-secondary cursor-pointer ${photoBusy ? "pointer-events-none opacity-60" : ""}`}>
                <Plus className="h-4 w-4" />
                {photoBusy ? t("contactHelp.contact.uploading") : t("contactHelp.contact.addPhotos")}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={contactMomentPhotoAccept}
                  multiple
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(event) => void uploadPhotos(event.target.files)}
                />
              </label>
            )}
          </div>
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
              {t("contactHelp.contact.noPhotos")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <figure key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {failedPhotoIds.includes(photo.id) ? (
                    <div className="grid aspect-[4/3] place-items-center bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500">
                      {t("contactHelp.contact.photoUnavailable")}
                    </div>
                  ) : (
                    <button type="button" className="block w-full" onClick={() => setSelectedPhotoId(photo.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Private API-backed photos are not compatible with Next image optimization. */}
                      <img
                        src={`${photoBaseUrl}/${encodeURIComponent(photo.id)}?${actorQuery}`}
                        alt={photo.originalName}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                        onError={() => setFailedPhotoIds((current) => current.includes(photo.id) ? current : [...current, photo.id])}
                      />
                    </button>
                  )}
                  <figcaption className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-600">{photo.originalName}</span>
                      <span className="text-[11px] text-slate-400">{formatBytes(photo.size)}</span>
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                        disabled={photoBusy}
                        onClick={() => void deletePhoto(photo.id)}
                        aria-label={t("contactHelp.contact.deletePhoto")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {readOnly && photos.length > 0 && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {t("contactHelp.contact.photosReadOnly")}
            </p>
          )}
          {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        </section>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="truncate text-sm font-bold text-slate-900">{selectedPhoto.originalName}</p>
              <button type="button" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100" onClick={() => setSelectedPhotoId(undefined)} aria-label={t("contactHelp.common.close")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-950 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- Private API-backed photos are not compatible with Next image optimization. */}
              <img
                src={`${photoBaseUrl}/${encodeURIComponent(selectedPhoto.id)}?${actorQuery}`}
                alt={selectedPhoto.originalName}
                className="max-h-[78vh] w-full object-contain"
                onError={() => setFailedPhotoIds((current) => current.includes(selectedPhoto.id) ? current : [...current, selectedPhoto.id])}
              />
            </div>
          </div>
        </div>
      )}

      {canManage && !isFinalContactMoment(contact) && (
        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-bold text-slate-950">{t("contactHelp.contact.closeWithoutReport")}</h2>
          <TextArea label={t("contactHelp.field.reason")} value={closedReason} onChange={setClosedReason} />
          {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!closedReason.trim()} onClick={() => updateStatus("geannuleerd")} className="btn-secondary"><X className="h-4 w-4" /> {t("contactHelp.contact.cancel")}</button>
            <button type="button" disabled={!closedReason.trim()} onClick={() => updateStatus("niet_uitgevoerd")} className="btn-secondary"><X className="h-4 w-4" /> {t("contactHelp.contact.notExecuted")}</button>
          </div>
        </section>
      )}
    </div>
  );
}

export function HelpRequestsWorkflowPage({ id, isNew }: { id?: string; isNew?: boolean }) {
  const { user, language } = useSession();
  const t = makeT(language);
  const workflow = useWorkflow();
  const { representatives } = useRepresentatives();
  const requests = workflow.visibleHelpRequests(user);
  if (isNew) return <NewHelpRequest />;
  if (id) {
    const request = workflow.state.helpRequests.find((item) => item.id === id);
    if (!request || !requests.some((item) => item.id === id)) {
      return <EmptyState title={t("contactHelp.help.unavailableTitle")} description={t("contactHelp.help.unavailableDescription")} />;
    }
    return <HelpRequestDetail request={request} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("contactHelp.help.eyebrow")}
        title={t("contactHelp.help.pageTitle")}
        description={t("contactHelp.help.pageDescription")}
        actions={<Link href="/hulpaanvragen/nieuw" className="btn-primary"><Plus className="h-4 w-4" /> {t("contactHelp.help.newAction")}</Link>}
      />
      {requests.length === 0 ? (
        <EmptyState title={t("contactHelp.help.emptyTitle")} description={t("contactHelp.help.emptyDescription")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[...requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((request) => {
            const representative = representatives.find((item) => item.id === request.representativeId);
            return (
              <Link key={request.id} href={`/hulpaanvragen/${request.id}`} className="card group p-5 transition hover:border-brand-200">
                <div className="flex items-center justify-between gap-3">
                  <UrgencyBadge urgency={request.urgency} />
                  <StatusBadge status={request.status} />
                </div>
                <h2 className="mt-5 font-bold text-slate-950">{request.subject}</h2>
                <p className="mt-1 text-sm text-slate-500">{representative?.firstName} {representative?.lastName}</p>
                <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{request.desiredResult}</p>
                <p className="mt-5 text-sm font-semibold text-brand-700 group-hover:underline">{t("contactHelp.common.view")}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewHelpRequest() {
  const { user, language } = useSession();
  const t = makeT(language);
  const { createHelpRequest } = useWorkflow();
  const [createdId, setCreatedId] = useState<string>();
  const [form, setForm] = useState({
    subject: "",
    descriptionHtml: "",
  });
  const [error, setError] = useState<string>();
  const valid = form.subject.trim().length > 0 && !isBlankRichText(form.descriptionHtml);
  const representativeId = user.representativeId ?? user.id;

  if (user.role !== "REPRESENTATIVE") {
    return <EmptyState title={t("contactHelp.common.noRightsTitle")} description={t("contactHelp.help.noCreateRights")} />;
  }

  if (createdId) {
    return <SuccessCard title={t("contactHelp.help.createdTitle")} description={t("contactHelp.help.createdDescription")} href={`/hulpaanvragen/${createdId}`} linkLabel={t("contactHelp.help.openHelpRequest")} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink href="/hulpaanvragen" label={t("contactHelp.help.backToList")} />
      <PageHeader eyebrow={t("contactHelp.common.new")} title={t("contactHelp.help.newTitle")} description={t("contactHelp.help.newDescription")} />
      <div className="card grid gap-6 p-5 sm:p-7">
        <TextInput label={t("contactHelp.field.subject")} value={form.subject} onChange={(subject) => setForm((current) => ({ ...current, subject }))} />
        <RichTextArea
          label={t("contactHelp.field.description")}
          value={form.descriptionHtml}
          onChange={(descriptionHtml) => setForm((current) => ({ ...current, descriptionHtml }))}
          placeholder={t("contactHelp.help.descriptionPlaceholder")}
        />
        {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <div className="flex justify-end">
          <button type="button" disabled={!valid} onClick={() => {
            try {
              const request = createHelpRequest({ ...form, requesterId: user.id, representativeId });
              setCreatedId(request.id);
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : t("contactHelp.help.submitError"));
            }
          }} className="btn-primary"><CircleHelp className="h-4 w-4" /> {t("contactHelp.help.submit")}</button>
        </div>
      </div>
    </div>
  );
}

function HelpRequestDetail({ request }: { request: HelpRequest }) {
  const router = useRouter();
  const { user, language } = useSession();
  const t = makeT(language);
  const { planHelpFollowUp, sendHelpAnswer, updateHelpRequest, withdrawHelpRequest } = useWorkflow();
  const { representatives } = useRepresentatives();
  const representative = representatives.find((item) => item.id === request.representativeId);
  const isRequester = user.role === "REPRESENTATIVE" && request.requesterId === user.id;
  const untreated = ["open", "nieuw"].includes(request.status) && !request.firstHandledAt && !(request.answers ?? []).length && !request.followUpType && !request.linkedInterventionId;
  const canRequesterEdit = isRequester && untreated;
  const canManage = user.role !== "REPRESENTATIVE" && representative ? canAccessRepresentative(user, representative) : false;
  const canHandle = canManage && ["open", "nieuw", "in_behandeling"].includes(request.status) && !request.linkedInterventionId && !["gesloten", "afgesloten", "ingetrokken", "geannuleerd"].includes(request.status);
  const canPlanCoachingFollowUp = canCreateIntervention(user);
  const sortedAnswers = [...(request.answers ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastAnswer = sortedAnswers.at(-1);
  const awaitsRequesterResponse = Boolean(isRequester && lastAnswer && !lastAnswer.closesRequest && lastAnswer.authorId !== user.id && request.status === "in_behandeling" && !request.followUpType && !request.linkedInterventionId);
  const awaitsManagerResponse = Boolean(canManage && (!lastAnswer || lastAnswer.authorId === request.requesterId) && request.status === "in_behandeling" && !request.followUpType && !request.linkedInterventionId);
  const canManagerHandle = canHandle && !awaitsRequesterResponse && (request.status !== "in_behandeling" || awaitsManagerResponse || !lastAnswer);
  const [followUp, setFollowUp] = useState<HelpRequestManagerAction>("");
  const [answerHtml, setAnswerHtml] = useState("");
  const [editSubject, setEditSubject] = useState(request.subject);
  const [editDescription, setEditDescription] = useState(request.descriptionHtml ?? request.explanation ?? request.difficulty);
  const [error, setError] = useState<string>();
  const [updated, setUpdated] = useState(false);
  const followUpLabels = Object.fromEntries(
    Object.entries(followUpLabelKeys).map(([value, key]) => [value, t(key)])
  ) as Record<FollowUpType, string>;

  if (updated) {
    return <SuccessCard title={t("contactHelp.help.detailUpdatedTitle")} description={t("contactHelp.help.detailUpdatedDescription")} href="/hulpaanvragen" linkLabel={t("contactHelp.help.toList")} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink href="/hulpaanvragen" label={t("contactHelp.help.backToList")} />
      <PageHeader eyebrow={t("contactHelp.help.singleEyebrow")} title={request.subject} description={representative ? `${representative.firstName} ${representative.lastName} · ${representative.team}` : t("contactHelp.common.representative")} actions={<StatusBadge status={request.status} />} />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5 sm:p-7">
          <div className="flex items-center gap-3"><CircleHelp className="h-5 w-5 text-brand-700" /><h2 className="font-bold text-slate-950">{t("contactHelp.help.questionTitle")}</h2></div>
          {canRequesterEdit ? (
            <div className="mt-5 space-y-5">
              <TextInput label={t("contactHelp.field.subject")} value={editSubject} onChange={setEditSubject} />
              <RichTextArea label={t("contactHelp.field.description")} value={editDescription} onChange={setEditDescription} placeholder={t("contactHelp.help.descriptionPlaceholder")} />
              {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={!editSubject.trim() || isBlankRichText(editDescription)} onClick={() => {
                  try {
                    updateHelpRequest({ id: request.id, requesterId: user.id, subject: editSubject, descriptionHtml: editDescription });
                    setUpdated(true);
                  } catch (updateError) {
                    setError(updateError instanceof Error ? updateError.message : t("contactHelp.help.updateError"));
                  }
                }} className="btn-primary"><Save className="h-4 w-4" /> {t("contactHelp.help.saveChanges")}</button>
                <button type="button" onClick={() => {
                  try {
                    withdrawHelpRequest(request.id, user.id);
                    setUpdated(true);
                  } catch (withdrawError) {
                    setError(withdrawError instanceof Error ? withdrawError.message : t("contactHelp.help.withdrawError"));
                  }
                }} className="btn-secondary"><X className="h-4 w-4" /> {t("contactHelp.help.withdraw")}</button>
              </div>
            </div>
          ) : (
            <RichTextRenderer value={request.descriptionHtml ?? request.explanation ?? request.difficulty} className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700" />
          )}
          {request.withdrawnAt && <InfoBlock label={t("contactHelp.field.withdrawnAt")} value={formatDateTime(request.withdrawnAt, language)} />}
          {request.firstHandledAt && <InfoBlock label={t("contactHelp.field.firstHandledAt")} value={formatDateTime(request.firstHandledAt, language)} />}
          {(request.answers ?? []).length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-bold text-slate-950">{t("contactHelp.help.answersTitle")}</h3>
              {sortedAnswers.map((answer) => (
                <div key={answer.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{formatDateTime(answer.createdAt, language)}</p>
                  <RichTextRenderer value={answer.bodyHtml} className="text-sm leading-6 text-slate-700" />
                </div>
              ))}
            </div>
          )}
          {awaitsRequesterResponse && (
            <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-4">
              <RichTextArea label={t("contactHelp.help.yourAnswer")} value={answerHtml} onChange={setAnswerHtml} placeholder={t("contactHelp.help.answerPlaceholder")} />
              {error && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
              <button type="button" disabled={isBlankRichText(answerHtml)} onClick={() => {
                try {
                  sendHelpAnswer({ helpRequestId: request.id, authorId: user.id, bodyHtml: answerHtml });
                  setUpdated(true);
                } catch (answerError) {
                  setError(answerError instanceof Error ? answerError.message : t("contactHelp.help.answerError"));
                }
              }} className="btn-primary mt-4"><CheckCircle2 className="h-4 w-4" /> {t("contactHelp.help.sendRepresentativeAnswer")}</button>
            </div>
          )}
        </section>
        <section className="card p-5 sm:p-7">
          <h2 className="font-bold text-slate-950">{t("contactHelp.help.followUpTitle")}</h2>
          {request.followUpType ? (
            <>
              <InfoBlock label={t("contactHelp.help.chosenFollowUp")} value={followUpLabels[request.followUpType]} />
              {request.linkedInterventionId && (
                <Link href={
                  request.followUpType === "contactmoment"
                    ? `/contactmomenten/${request.linkedInterventionId}`
                    : request.followUpType === "begeleiding"
                      ? `/begeleidingen/${request.linkedInterventionId}`
                    : request.followUpType === "retraining"
                      ? `/retrainingen/${request.linkedInterventionId}`
                      : request.followUpType === "sales_training"
                        ? `/sales-trainingen/${request.linkedInterventionId}`
                        : `/vertegenwoordigers/${request.representativeId}`
                } className="btn-secondary mt-5 w-full">
                  {t("contactHelp.help.openLinkedIntervention")}
                </Link>
              )}
            </>
          ) : canManagerHandle ? (
            <>
              <RichTextArea label={t("contactHelp.field.answer")} value={answerHtml} onChange={setAnswerHtml} placeholder={t("contactHelp.help.answerPlaceholder")} />
              {error && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
              <label className="mt-5 block">
                <span className="text-sm font-bold text-slate-900">{t("contactHelp.help.chooseFollowUp")}</span>
                <select className="field mt-2" value={followUp} onChange={(event) => setFollowUp(event.target.value as HelpRequestManagerAction)}>
                  <option value="">{t("contactHelp.help.chooseFollowUpPlaceholder")}</option>
                  {Object.entries(followUpLabels)
                    .filter(([value]) => !["enkel_opvolging", "geen_actie"].includes(value))
                    .filter(([value]) => value !== "begeleiding" || canPlanCoachingFollowUp)
                    .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  <option value="geen_actie">{t("contactHelp.followUp.close")}</option>
                  <option value="respons">{t("contactHelp.followUp.response")}</option>
                </select>
              </label>
              <button type="button" disabled={isBlankRichText(answerHtml) || !followUp} onClick={() => {
                try {
                  if (!followUp) {
                    throw new Error(t("contactHelp.help.chooseFollowUpRequired"));
                  }
                  if (followUp === "respons") {
                    sendHelpAnswer({ helpRequestId: request.id, authorId: user.id, bodyHtml: answerHtml });
                    setUpdated(true);
                    return;
                  }
                  if (followUp === "begeleiding") {
                    if (!canPlanCoachingFollowUp) {
                      throw new Error(t("contactHelp.help.noCoachingRights"));
                    }
                    sendHelpAnswer({ helpRequestId: request.id, authorId: user.id, bodyHtml: answerHtml });
                    router.push(`/begeleidingen/nieuw?helpRequestId=${encodeURIComponent(request.id)}`);
                    return;
                  }
                  planHelpFollowUp(request.id, user.id, followUp, answerHtml);
                  setUpdated(true);
                } catch (followUpError) {
                  setError(followUpError instanceof Error ? followUpError.message : t("contactHelp.help.followUpError"));
                }
              }} className="btn-primary mt-5 w-full"><ClipboardCheck className="h-4 w-4" /> {t("contactHelp.help.send")}</button>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">{t("contactHelp.help.readOnly")}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function RepresentativePicker({ label, available, value, onChange, disabled = false }: { label: string; available: Representative[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <select disabled={disabled} className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {available.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.team}</option>)}
      </select>
    </label>
  );
}

function TagPicker({ label, options, value, onChange }: { label: string; options: readonly ThemeOption[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-slate-900">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.includes(option.value);
          return <button type="button" key={option.value} onClick={() => onChange(active ? value.filter((item) => item !== option.value) : [...value, option.value])} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`}>{option.label}</button>;
        })}
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) {
  const { language } = useSession();
  const t = makeT(language);
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900">{label} {optional && <span className="font-normal text-slate-400">{t("contactHelp.form.optional")}</span>}</span>
      <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
    </label>
  );
}

function RichTextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { language } = useSession();
  const t = makeT(language);
  const editorRef = useRef<HTMLDivElement>(null);
  const runCommand = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className="block">
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <div className="mt-2 rounded-2xl border border-slate-200 bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2">
          <EditorButton label={t("contactHelp.editor.bold")} onClick={() => runCommand("bold")}>B</EditorButton>
          <EditorButton label={t("contactHelp.editor.italic")} onClick={() => runCommand("italic")}>I</EditorButton>
          <EditorButton label={t("contactHelp.editor.bulletList")} onClick={() => runCommand("insertUnorderedList")}>•</EditorButton>
          <EditorButton label={t("contactHelp.editor.numberedList")} onClick={() => runCommand("insertOrderedList")}>1.</EditorButton>
        </div>
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          data-placeholder={placeholder ?? t("contactHelp.form.richTextPlaceholder")}
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          onBlur={(event) => onChange(sanitizeRichText(event.currentTarget.innerHTML))}
          className="rich-text-editor min-h-40 w-full rounded-b-2xl p-4 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
          suppressContentEditableWarning
        />
      </div>
      <span className="mt-2 block text-xs text-slate-400">{t("contactHelp.form.richTextHelp")}</span>
    </div>
  );
}

function EditorButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
      {children}
    </button>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="text-sm font-bold text-slate-900">{label}</span><input type={type} className="field mt-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm leading-6 text-slate-700">{value}</p></div>;
}

function UrgencyBadge({ urgency }: { urgency: HelpRequest["urgency"] }) {
  const style = urgency === "hoog" ? "bg-rose-100 text-rose-800" : urgency === "laag" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${style}`}>{urgency}</span>;
}

function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="h-4 w-4" /> {label}</Link>;
}

function isFinalContactMoment(contact: ContactMoment) {
  return contact.status === "afgesloten" || contact.status === "geannuleerd" || contact.status === "niet_uitgevoerd";
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Blob kon niet worden gelezen."));
    reader.readAsDataURL(blob);
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function SuccessCard({ title, description, href, linkLabel }: { title: string; description: string; href: string; linkLabel: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card p-8 text-center sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-8 w-8" /></div>
        <h1 className="mt-6 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
        <Link href={href} className="btn-primary mt-7">{linkLabel}</Link>
      </div>
    </div>
  );
}
