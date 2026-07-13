import { canAccessManagementSection } from "@/lib/management-access";
import { badRequest, forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { sendMailSettingsTest } from "@/lib/server/mail-service";
import {
  mailTestProductionConfirmation,
  isMailTestForced,
  normalizeMailTestRecipient,
  setMailTestSettings,
} from "@/lib/server/mail-test";
import {
  getMailSettings,
  normalizeMailSettingsUpdate,
  setMailSettings,
  type MailSettingsUpdate,
} from "@/lib/server/mail-settings";

export const dynamic = "force-dynamic";

type MailTestUpdatePayload = {
  actorId?: string;
  active?: unknown;
  confirmation?: unknown;
  recipient?: unknown;
} & Partial<Record<keyof MailSettingsUpdate, unknown>>;

export async function GET(request: Request) {
  return handleApi(
    "api/management/settings/mail-test:get",
    async () => {
      const url = new URL(request.url);
      const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
      requireSettingsAccess(actor);
      return readMailSettingsResponse();
    },
    "MAIL TEST kon niet worden geladen."
  );
}

export async function PUT(request: Request) {
  return handleApi(
    "api/management/settings/mail-test:put",
    async () => {
      const payload = await readUpdatePayload(request);
      const actor = await requireAuthenticatedUser(payload.actorId);
      requireSettingsAccess(actor);

      const requestedMailTestActive = isFullMailSettingsPayload(payload)
        ? payload.mailTestActive
        : payload.active;
      if (requestedMailTestActive === false && isMailTestForced()) {
        badRequest("MAIL TEST kan niet worden uitgeschakeld in een ontwikkel- of testomgeving.");
      }

      if (isFullMailSettingsPayload(payload)) {
        const normalized = normalizeMailSettingsUpdate({
          mailTestActive: payload.mailTestActive,
          mailTestRecipient: payload.mailTestRecipient,
          confirmation: typeof payload.confirmation === "string" ? payload.confirmation : undefined,
          smtpEnabled: payload.smtpEnabled,
          smtpHost: payload.smtpHost,
          smtpPort: payload.smtpPort,
          smtpSecurity: payload.smtpSecurity,
          smtpAuthType: payload.smtpAuthType,
          smtpUsername: payload.smtpUsername,
          smtpPassword: typeof payload.smtpPassword === "string" ? payload.smtpPassword : undefined,
          clearSmtpPassword: Boolean(payload.clearSmtpPassword),
          defaultFromEmail: payload.defaultFromEmail,
          defaultFromName: payload.defaultFromName,
          defaultReplyToEmail: payload.defaultReplyToEmail,
        });
        await setMailSettings({ ...normalized, actorId: actor.id });
        return readMailSettingsResponse();
      }

      if (typeof payload.active !== "boolean") {
        badRequest("De waarde voor MAIL TEST moet actief of uitgeschakeld zijn.");
      }
      if (
        payload.confirmation !== undefined &&
        typeof payload.confirmation !== "string"
      ) {
        badRequest("De bevestiging voor MAIL TEST is ongeldig.");
      }
      if (typeof payload.recipient !== "string") {
        badRequest("De MAIL TEST-ontvanger is verplicht.");
      }
      const recipient = normalizeMailTestRecipient(payload.recipient);
      if (!recipient) {
        badRequest("Geef een geldig e-mailadres voor de MAIL TEST-ontvanger in.");
      }
      if (
        !payload.active &&
        payload.confirmation !== mailTestProductionConfirmation
      ) {
        badRequest(
          `Typ exact ${mailTestProductionConfirmation} om MAIL TEST uit te schakelen.`
        );
      }

      await setMailTestSettings({
        active: payload.active,
        actorId: actor.id,
        confirmation: payload.confirmation as string | undefined,
        recipient,
      });
      return readMailSettingsResponse();
    },
    "MAIL TEST kon niet worden opgeslagen."
  );
}

export async function POST(request: Request) {
  return handleApi(
    "api/management/settings/mail-test:post",
    async () => {
      const payload = await readActorPayload(request);
      const actor = await requireAuthenticatedUser(payload.actorId);
      requireSettingsAccess(actor);
      const settings = await getMailSettings();
      if (!settings.ready) {
        badRequest(
          `De opgeslagen SMTP-instellingen zijn niet volledig: ${settings.missing.join(", ") || "onbekend"}.`
        );
      }
      await sendMailSettingsTest({
        actorId: actor.id,
        actorName: actor.name,
        language: actor.language,
        recipient: settings.mailTest.recipient,
      });
      return {
        sent: true,
        recipient: settings.mailTest.recipient,
      };
    },
    "De testmail kon niet worden verzonden."
  );
}

function requireSettingsAccess(
  actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>
) {
  if (!canAccessManagementSection(actor, "instellingen")) {
    forbidden("Je hebt geen toegang tot de algemene instellingen.");
  }
}

async function readMailSettingsResponse() {
  const settings = await getMailSettings();
  return {
    setting: settings.mailTest,
    mailSettings: settings,
  };
}

function isFullMailSettingsPayload(payload: MailTestUpdatePayload): payload is MailTestUpdatePayload & MailSettingsUpdate {
  return typeof payload.mailTestActive === "boolean" &&
    typeof payload.mailTestRecipient === "string" &&
    typeof payload.smtpEnabled === "boolean" &&
    typeof payload.smtpHost === "string" &&
    typeof payload.smtpPort === "number" &&
    typeof payload.smtpSecurity === "string" &&
    typeof payload.smtpAuthType === "string" &&
    typeof payload.smtpUsername === "string" &&
    typeof payload.defaultFromEmail === "string" &&
    typeof payload.defaultFromName === "string" &&
    typeof payload.defaultReplyToEmail === "string";
}

async function readActorPayload(request: Request): Promise<{ actorId?: string }> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    badRequest("De aanvraag voor de testmail bevat geen geldige JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    badRequest("De aanvraag voor de testmail is ongeldig.");
  }
  return payload as { actorId?: string };
}

async function readUpdatePayload(request: Request): Promise<MailTestUpdatePayload> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    badRequest("De aanvraag voor MAIL TEST bevat geen geldige JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    badRequest("De aanvraag voor MAIL TEST is ongeldig.");
  }
  return payload as MailTestUpdatePayload;
}
