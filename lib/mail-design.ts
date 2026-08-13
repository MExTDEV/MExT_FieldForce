import { sanitizeRichText } from "@/lib/rich-text";
import type { Language } from "@/lib/types";

const designAttribute = "data-fieldforce-mail-design=\"1\"";

export type MailDesignStyles = {
  backgroundColor: string;
  cardColor: string;
  headerColor: string;
  headerTextColor: string;
  bodyTextColor: string;
  footerColor: string;
  footerTextColor: string;
  linkColor: string;
};

export const defaultMailDesignStyles: MailDesignStyles = {
  backgroundColor: "#f1f5f9",
  cardColor: "#ffffff",
  headerColor: "#0f766e",
  headerTextColor: "#ffffff",
  bodyTextColor: "#0f172a",
  footerColor: "#ffffff",
  footerTextColor: "#475569",
  linkColor: "#1d4ed8",
};

export type MailDesignParts = {
  headerHtml: string;
  bodyHtml: string;
  footerHtml: string;
  styles?: MailDesignStyles;
};

export function buildMailDesign(parts: MailDesignParts) {
  const styles = sanitizeMailDesignStyles(parts.styles);
  return `<div ${designAttribute}${Object.entries(styles).map(([key, value]) => ` data-fieldforce-mail-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${value}"`).join("")}><div data-fieldforce-mail-section="header">${sanitizeRichText(parts.headerHtml)}</div><div data-fieldforce-mail-section="body">${sanitizeRichText(parts.bodyHtml)}</div><div data-fieldforce-mail-section="footer">${sanitizeRichText(parts.footerHtml)}</div></div>`;
}

export function parseMailDesign(value: string | null | undefined): MailDesignParts | null {
  if (!value?.includes(designAttribute)) return null;
  const sections = {
    headerHtml: readSection(value, "header"),
    bodyHtml: readSection(value, "body"),
    footerHtml: readSection(value, "footer"),
  };
  if (sections.headerHtml === null || sections.bodyHtml === null || sections.footerHtml === null) return null;
  return { headerHtml: sections.headerHtml, bodyHtml: sections.bodyHtml, footerHtml: sections.footerHtml, styles: readStyles(value) };
}

export function sanitizeMailDesign(value: string | null | undefined) {
  const parsed = parseMailDesign(value);
  return parsed ? buildMailDesign(parsed) : sanitizeRichText(value);
}

export function defaultMailDesign(language: Language, bodyHtml = "") {
  const footer = language === "fr"
    ? "<p>Vous recevez cet e-mail de FieldForce. Pour toute question, contactez votre équipe.</p>"
    : language === "de"
      ? "<p>Sie erhalten diese E-Mail von FieldForce. Bei Fragen wenden Sie sich an Ihr Team.</p>"
      : "<p>Je ontvangt deze e-mail van FieldForce. Neem bij vragen contact op met je team.</p>";
  return buildMailDesign({
    headerHtml: "<p><strong>MExT FieldForce</strong></p>",
    bodyHtml: bodyHtml || "<p></p>",
    footerHtml: footer,
  });
}

export function sanitizeMailDesignStyles(styles: Partial<MailDesignStyles> | undefined): MailDesignStyles {
  return Object.fromEntries(Object.entries(defaultMailDesignStyles).map(([key, fallback]) => [key, normalizeColor(styles?.[key as keyof MailDesignStyles]) ?? fallback])) as MailDesignStyles;
}

function readStyles(value: string): MailDesignStyles {
  const styles = Object.fromEntries(Object.keys(defaultMailDesignStyles).map((key) => {
    const attribute = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const match = value.match(new RegExp(`data-fieldforce-mail-${attribute}=["']([^"']+)["']`, "i"));
    return [key, match?.[1]];
  })) as Partial<MailDesignStyles>;
  return sanitizeMailDesignStyles(styles);
}

function normalizeColor(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return /^#[0-9a-f]{3,8}$/i.test(normalized) ? normalized : undefined;
}

function readSection(value: string, section: "header" | "body" | "footer") {
  const match = value.match(new RegExp(`<div\\s+data-fieldforce-mail-section=[\"']${section}[\"']\\s*>([\\s\\S]*?)<\\/div>`, "i"));
  return match?.[1] ?? null;
}
