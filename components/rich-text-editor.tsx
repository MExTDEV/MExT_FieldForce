"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  helpText,
  required = false,
  disabled = false,
  minHeightClass = "min-h-40",
  toolbarLabels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  minHeightClass?: string;
  toolbarLabels: {
    bold: string;
    italic: string;
    bulletList: string;
    numberedList: string;
  };
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const runCommand = (command: string) => {
    if (disabled) return;
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
      <span className="text-sm font-bold text-slate-900">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </span>
      <div className="mt-2 rounded-2xl border border-slate-200 bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2">
          <EditorButton label={toolbarLabels.bold} disabled={disabled} onClick={() => runCommand("bold")}>B</EditorButton>
          <EditorButton label={toolbarLabels.italic} disabled={disabled} onClick={() => runCommand("italic")}>I</EditorButton>
          <EditorButton label={toolbarLabels.bulletList} disabled={disabled} onClick={() => runCommand("insertUnorderedList")}>•</EditorButton>
          <EditorButton label={toolbarLabels.numberedList} disabled={disabled} onClick={() => runCommand("insertOrderedList")}>1.</EditorButton>
        </div>
        <div
          ref={editorRef}
          contentEditable={!disabled}
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          data-placeholder={placeholder}
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          onBlur={(event) => onChange(sanitizeRichText(event.currentTarget.innerHTML))}
          className={`rich-text-editor ${minHeightClass} w-full rounded-b-2xl p-4 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`}
          suppressContentEditableWarning
        />
      </div>
      {helpText && <span className="mt-2 block text-xs text-slate-400">{helpText}</span>}
    </div>
  );
}

function EditorButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
