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
  "span",
  "mark",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
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
      if (name === "img") {
        const src = normalizeSafeImageSrc(getAttribute(tag, "src"));
        if (!src) return "";
        const alt = escapeAttribute(getAttribute(tag, "alt") ?? "");
        const width = normalizeImageDimension(getAttribute(tag, "width"));
        const height = normalizeImageDimension(getAttribute(tag, "height"));
        const dimensions = `${width ? ` width="${width}"` : ""}${height ? ` height="${height}"` : ""}`;
        const responsiveStyle = width ? ` style="display:block;max-width:100%;width:${width}px;height:auto;"` : "";
        return `<img src="${escapeAttribute(src)}" alt="${alt}"${dimensions}${responsiveStyle}>`;
      }
      if (name === "mark") {
        const color = normalizeSafeColor(getAttribute(tag, "data-color"));
        return color ? `<mark style="background-color:${color}">` : "<mark>";
      }
      if (name === "span" || /^h[1-6]$/.test(name) || name === "p" || name === "blockquote" || name === "th" || name === "td") {
        const style = sanitizeInlineStyle(getAttribute(tag, "style"));
        const styleAttribute = style ? ` style="${escapeAttribute(style)}"` : "";
        if (name === "th" || name === "td") {
          const colspan = normalizeTableSpan(getAttribute(tag, "colspan"));
          const rowspan = normalizeTableSpan(getAttribute(tag, "rowspan"));
          return `<${name}${colspan ? ` colspan="${colspan}"` : ""}${rowspan ? ` rowspan="${rowspan}"` : ""}${styleAttribute}>`;
        }
        return `<${name}${styleAttribute}>`;
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
  if (/^(https?:|mailto:)/i.test(value) || /^\/{1,2}[^/]/.test(value) || /^{{[a-zA-Z0-9_.]+}}$/.test(value)) return value;
  return "";
}

function normalizeSafeImageSrc(rawValue: string | undefined) {
  const value = rawValue?.trim() ?? "";
  return /^https?:\/\//i.test(value) ? value : "";
}

function normalizeImageDimension(value: string | undefined) {
  const dimension = Number(value);
  return Number.isInteger(dimension) && dimension >= 1 && dimension <= 2400 ? String(dimension) : "";
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "i"));
  return match?.[1]?.replace(/^['"]|['"]$/g, "");
}

function normalizeSafeColor(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\))$/i.test(normalized) ? normalized : "";
}

function sanitizeInlineStyle(value: string | undefined) {
  if (!value) return "";
  const declarations = value.split(";").flatMap((declaration) => {
    const [property, ...rawValues] = declaration.split(":");
    const normalizedProperty = property?.trim().toLowerCase();
    const normalizedValue = rawValues.join(":").trim();
    if (!normalizedProperty || !normalizedValue) return [];
    if (normalizedProperty === "text-align" && /^(left|center|right|justify)$/i.test(normalizedValue)) return [`text-align:${normalizedValue}`];
    if ((normalizedProperty === "color" || normalizedProperty === "background-color") && normalizeSafeColor(normalizedValue)) return [`${normalizedProperty}:${normalizeSafeColor(normalizedValue)}`];
    return [];
  });
  return declarations.join(";");
}

function normalizeTableSpan(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 20 ? String(number) : "";
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
