"use client";

import { useRef, useState } from "react";
import { ChevronDown, Plus, Save, X } from "lucide-react";

import { useSession } from "@/components/session-provider";
import { decodeUtf8CsvBytes } from "@/lib/csv-encoding";
import { translate } from "@/lib/i18n";
import {
  managementImportExportTopics,
  type ManagementImportExportTopic,
  type ManagementImportResult,
} from "@/lib/management-import-export";

type Props = {
  topic: ManagementImportExportTopic;
  onCommitted?: () => Promise<void> | void;
};

export function ManagementImportExportPanel({ topic, onCommitted }: Props) {
  const { user } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ManagementImportResult>();
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string }>();
  const [busy, setBusy] = useState<"export" | "validate" | "commit">();

  const hasAccess =
    user.role === "SUPER_ADMIN" && Boolean(user.permissions?.technicalImportExport);
  if (!hasAccess) return null;

  const topicConfig = managementImportExportTopics[topic];
  const topicLabel = translate(user.language, topicConfig.labelKey);
  const hasValidationErrors = Boolean(result?.errors.length);

  async function downloadExport() {
    setNotice(undefined);
    setBusy("export");
    try {
      const response = await fetch(
        `/api/management/import-export/${topic}?actorId=${encodeURIComponent(user.id)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? translate(user.language, "importExport.exportError"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = topicConfig.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error
          ? error.message
          : translate(user.language, "importExport.exportError"),
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function chooseFile(file?: File) {
    setNotice(undefined);
    setResult(undefined);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setNotice({ type: "error", message: translate(user.language, "importExport.invalidFile") });
      return;
    }
    const decoded = decodeUtf8CsvBytes(await file.arrayBuffer());
    if (!decoded.ok) {
      setNotice({
        type: "error",
        message: decoded.problem === "invalid-utf8"
          ? translate(user.language, "importExport.invalidEncoding")
          : translate(user.language, "importExport.replacementCharacter"),
      });
      return;
    }
    const text = decoded.text;
    setCsv(text);
    setFileName(file.name);
    await validateCsv(text);
  }

  async function validateCsv(nextCsv = csv) {
    if (!nextCsv.trim()) {
      setNotice({ type: "error", message: translate(user.language, "importExport.noFile") });
      return;
    }
    setBusy("validate");
    setNotice(undefined);
    try {
      const validated = await sendImport("validate", nextCsv);
      setResult(validated);
      setNotice({
        type: validated.errors.length ? "error" : "success",
        message: validated.errors.length
          ? translate(user.language, "importExport.validationErrors")
          : translate(user.language, "importExport.validationOk"),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error
          ? error.message
          : translate(user.language, "importExport.validateError"),
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function commitCsv() {
    if (!result || hasValidationErrors || !csv.trim()) return;
    setBusy("commit");
    setNotice(undefined);
    try {
      const committed = await sendImport("commit", csv);
      setResult(committed);
      if (committed.errors.length) {
        setNotice({ type: "error", message: translate(user.language, "importExport.commitErrors") });
        return;
      }
      setNotice({ type: "success", message: translate(user.language, "importExport.commitOk") });
      await onCommitted?.();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error
          ? error.message
          : translate(user.language, "importExport.commitError"),
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function sendImport(mode: "validate" | "commit", payloadCsv: string) {
    const response = await fetch(`/api/management/import-export/${topic}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: user.id, mode, csv: payloadCsv }),
    });
    const payload = await response.json() as ManagementImportResult & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? translate(user.language, "importExport.importError"));
    }
    return payload;
  }

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700">
            {translate(user.language, "importExport.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {translate(user.language, "importExport.description")} {topicLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void downloadExport()}
            disabled={Boolean(busy)}
          >
            <ChevronDown className="h-4 w-4" /> {translate(user.language, "importExport.export")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(busy)}
            title={translate(user.language, "importExport.importTooltip")}
          >
            <Plus className="h-4 w-4" /> {translate(user.language, "importExport.chooseFile")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!result || hasValidationErrors || busy === "commit"}
            onClick={() => void commitCsv()}
          >
            <Save className="h-4 w-4" /> {translate(user.language, "importExport.commit")}
          </button>
        </div>
      </div>

      {fileName && (
        <p className="text-xs font-semibold text-slate-500">
          {translate(user.language, "importExport.selectedFile")}: {fileName}
        </p>
      )}

      {notice && (
        <p className={`rounded-md border p-3 text-sm font-semibold ${
          notice.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {notice.message}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <SummaryPill label={translate(user.language, "importExport.created")} value={result.created} />
            <SummaryPill label={translate(user.language, "importExport.updated")} value={result.updated} />
            <SummaryPill label={translate(user.language, "importExport.skipped")} value={result.skipped} />
            <SummaryPill label={translate(user.language, "importExport.errors")} value={result.errors.length} danger={result.errors.length > 0} />
          </div>

          {result.errors.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-rose-100">
              <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                <X className="h-4 w-4" />
                {translate(user.language, "importExport.errors")}
              </div>
              <div className="max-h-56 overflow-auto divide-y divide-rose-100 bg-white">
                {result.errors.slice(0, 25).map((error, index) => (
                  <p key={`${error.row}-${index}`} className="px-3 py-2 text-sm text-rose-700">
                    {translate(user.language, "importExport.row")} {error.row}: {error.message}
                  </p>
                ))}
                {result.errors.length > 25 && (
                  <p className="px-3 py-2 text-sm font-semibold text-rose-700">
                    +{result.errors.length - 25}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-emerald-700">
              {translate(user.language, "importExport.noErrors")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryPill({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${
      danger ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
    }`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${danger ? "text-rose-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
