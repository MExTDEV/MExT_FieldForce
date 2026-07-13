const allowedRichTextTags = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "a",
  "hr",
]);

export function sanitizeRichText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?>/gi, (tag, rawName: string) => {
      const name = rawName.toLowerCase();
      if (!allowedRichTextTags.has(name)) return "";
      if (tag.startsWith("</")) return `</${name}>`;
      if (name === "br" || name === "hr") return `<${name}>`;
      if (name === "a") {
        const hrefMatch = tag.match(/\shref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
        const href = normalizeSafeHref(hrefMatch?.[1]);
        return href
          ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">`
          : "<a>";
      }
      return `<${name}>`;
    });
}

export function richTextToPlainText(value: string | null | undefined) {
  if (!value) return "";
  return sanitizeRichText(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function richTextToStructuredPlainText(value: string | null | undefined) {
  if (!value) return "";
  let listMode: "ordered" | "unordered" | undefined;
  let orderedIndex = 0;
  return sanitizeRichText(value)
    .replace(/<\/?(ol|ul|li)\b[^>]*>/gi, (tag, rawName: string) => {
      const name = rawName.toLowerCase();
      const closing = tag.startsWith("</");
      if (name === "ol" && !closing) {
        listMode = "ordered";
        orderedIndex = 0;
        return "\n";
      }
      if (name === "ul" && !closing) {
        listMode = "unordered";
        return "\n";
      }
      if ((name === "ol" || name === "ul") && closing) {
        listMode = undefined;
        return "\n";
      }
      if (name === "li" && closing) return "";
      return listMode === "ordered" ? `\n${++orderedIndex}. ` : "\n- ";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_match, href: string, label: string) => {
      const text = decodeHtml(label.replace(/<[^>]+>/g, "")).trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<[^>]+>/g, "")
    .split(/\n+/)
    .map((line) => decodeHtml(line).replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function isBlankRichText(value: string | null | undefined) {
  return richTextToPlainText(value).length === 0;
}

export function hasHtmlMarkup(value: string | null | undefined) {
  return Boolean(value && /<[^>]+>/.test(value));
}

function normalizeSafeHref(rawValue: string | undefined) {
  if (!rawValue) return "";
  const value = rawValue.trim().replace(/^["']|["']$/g, "");
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return "";
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'");
}
