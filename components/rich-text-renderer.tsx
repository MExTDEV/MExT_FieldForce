"use client";

import type { ReactNode } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

export function RichTextRenderer({
  value,
  className = "",
  empty = null,
}: {
  value: string | null | undefined;
  className?: string;
  empty?: ReactNode;
}) {
  if (!value) return empty;
  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(value ?? "") }}
    />
  );
}
