"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent, type RefObject } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TiptapImage from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Plus } from "lucide-react";
import { sanitizeRichText } from "@/lib/rich-text";

type EditorLabels = {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  heading: string;
  paragraph: string;
  bulletList: string;
  numberedList: string;
  quote: string;
  link: string;
  unlink: string;
  image: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  highlight: string;
  textColor: string;
  undo: string;
  redo: string;
  clear: string;
  table: string;
  parameter: string;
  linkPrompt: string;
  imagePrompt: string;
  imageAltPrompt: string;
  imageUpload: string;
  imageUrl: string;
  imageFile: string;
  imageWidth: string;
  imageHeight: string;
  imageKeepRatio: string;
  imageInsert: string;
  imageCancel: string;
  imageUploading: string;
  imageUploadError: string;
};

type Parameter = { key: string; descriptionNl?: string; labelNl?: string };

export function TransactionalMailEditor({
  label,
  value,
  onChange,
  placeholder,
  helpText,
  required = false,
  disabled = false,
  labels,
  parameters = [],
  contentStyle,
  actorId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  labels: EditorLabels;
  parameters?: Parameter[];
  contentStyle?: string;
  actorId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageMode, setImageMode] = useState<"url" | "upload">("url");
  const [imageSource, setImageSource] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageWidth, setImageWidth] = useState(600);
  const [imageHeight, setImageHeight] = useState(338);
  const [imageRatio, setImageRatio] = useState(600 / 338);
  const [keepImageRatio, setKeepImageRatio] = useState(true);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string>();
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
    }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color.configure({ types: [TextStyle.name] }),
    MailImage.configure({ allowBase64: false, inline: false }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder: placeholder ?? "" }),
  ], [placeholder]);

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "transactional-mail-editor-content",
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        ...(contentStyle ? { style: contentStyle } : {}),
      },
    },
    onUpdate: ({ editor: current }) => onChange(sanitizeRichText(current.getHTML())),
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
    editor.setEditable(!disabled);
  }, [disabled, editor, value]);

  if (!editor) {
    return <div className="mt-2 min-h-56 rounded-2xl border border-slate-200 bg-white" />;
  }

  const run = (command: () => boolean) => {
    if (!disabled) command();
  };
  const buttonProps = (title: string) => ({
    type: "button" as const,
    title,
    "aria-label": title,
    disabled,
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    className: "inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40",
  });
  const setLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt(labels.linkPrompt, current ?? "https://");
    if (href === null) return;
    if (!href.trim()) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: href.trim() }).run();
  };
  const openImageDialog = () => {
    setImageDialogOpen(true);
    setImageMode("url");
    setImageSource("");
    setImagePreviewUrl("");
    setSelectedFile(null);
    setImageAlt("");
    setImageWidth(600);
    setImageHeight(338);
    setImageRatio(600 / 338);
    setKeepImageRatio(true);
    setImageError(undefined);
  };
  const closeImageDialog = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageDialogOpen(false);
    setImagePreviewUrl("");
    setSelectedFile(null);
    setImageError(undefined);
  };
  const loadImageDimensions = (source: string) => {
    if (!source) return;
    const image = new window.Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      const width = Math.min(image.naturalWidth, 600);
      setImageRatio(ratio);
      setImageWidth(width);
      setImageHeight(Math.max(1, Math.round(width / ratio)));
    };
    image.src = source;
  };
  const selectImageFile = (file: File | undefined) => {
    if (!file) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const preview = URL.createObjectURL(file);
    setSelectedFile(file);
    setImagePreviewUrl(preview);
    setImageSource("");
    setImageError(undefined);
    loadImageDimensions(preview);
  };
  const changeImageDimension = (dimension: "width" | "height", rawValue: string) => {
    const value = Math.max(1, Math.min(2400, Math.round(Number(rawValue) || 1)));
    if (dimension === "width") {
      setImageWidth(value);
      if (keepImageRatio) setImageHeight(Math.max(1, Math.round(value / imageRatio)));
    } else {
      setImageHeight(value);
      if (keepImageRatio) setImageWidth(Math.max(1, Math.round(value * imageRatio)));
    }
  };
  const insertImage = async () => {
    setImageError(undefined);
    let src = imageSource.trim();
    if (imageMode === "upload") {
      if (!selectedFile || !actorId) {
        setImageError(labels.imageUploadError);
        return;
      }
      setImageBusy(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("actorId", actorId);
        formData.append("altText", imageAlt.trim());
        const response = await fetch("/api/management/mail/assets", { method: "POST", body: formData });
        const payload = await response.json() as { asset?: { publicUrl: string }; error?: string };
        if (!response.ok || !payload.asset?.publicUrl) throw new Error(payload.error ?? labels.imageUploadError);
        src = payload.asset.publicUrl;
      } catch (cause) {
        setImageError(cause instanceof Error ? cause.message : labels.imageUploadError);
        setImageBusy(false);
        return;
      }
      setImageBusy(false);
    }
    if (!src) {
      setImageError(labels.imagePrompt);
      return;
    }
    editor.chain().focus().setImage({ src, alt: imageAlt.trim(), width: imageWidth, height: imageHeight }).run();
    closeImageDialog();
  };

  return (
    <div className="block">
      <span className="block text-sm font-bold text-slate-900">{label}{required && <span className="text-rose-600"> *</span>}</span>
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
          <select className="h-9 rounded-lg border-0 bg-transparent px-2 text-xs font-semibold text-slate-700 outline-none hover:bg-white" value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"} onChange={(event) => run(() => event.target.value === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 }).run())} aria-label={labels.heading}>
            <option value="p">{labels.paragraph}</option><option value="h1">{labels.heading} 1</option><option value="h2">{labels.heading} 2</option><option value="h3">{labels.heading} 3</option>
          </select>
          <ToolbarButton {...buttonProps(labels.bold)} active={editor.isActive("bold")} onClick={() => run(() => editor.chain().focus().toggleBold().run())}><strong>B</strong></ToolbarButton>
          <ToolbarButton {...buttonProps(labels.italic)} active={editor.isActive("italic")} onClick={() => run(() => editor.chain().focus().toggleItalic().run())}><em>I</em></ToolbarButton>
          <ToolbarButton {...buttonProps(labels.underline)} active={editor.isActive("underline")} onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}><u>U</u></ToolbarButton>
          <ToolbarButton {...buttonProps(labels.strike)} active={editor.isActive("strike")} onClick={() => run(() => editor.chain().focus().toggleStrike().run())}><s>S</s></ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton {...buttonProps(labels.bulletList)} active={editor.isActive("bulletList")} onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}>•</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.numberedList)} active={editor.isActive("orderedList")} onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}>1.</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.quote)} active={editor.isActive("blockquote")} onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())}>❝</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.table)} onClick={() => run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>▦</ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton {...buttonProps(labels.alignLeft)} active={editor.isActive({ textAlign: "left" })} onClick={() => run(() => editor.chain().focus().setTextAlign("left").run())}>≡</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.alignCenter)} active={editor.isActive({ textAlign: "center" })} onClick={() => run(() => editor.chain().focus().setTextAlign("center").run())}>≡</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.alignRight)} active={editor.isActive({ textAlign: "right" })} onClick={() => run(() => editor.chain().focus().setTextAlign("right").run())}>≡</ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton {...buttonProps(labels.link)} active={editor.isActive("link")} onClick={() => run(() => { setLink(); return true; })}>↗</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.image)} onClick={() => run(() => { openImageDialog(); return true; })}>▧</ToolbarButton>
          <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 hover:bg-white" title={labels.textColor} aria-label={labels.textColor}>
            <span className="text-sm font-black" style={{ color: editor.getAttributes("textStyle").color ?? "#334155" }}>A</span>
            <input type="color" className="sr-only" disabled={disabled} onChange={(event) => run(() => editor.chain().focus().setColor(event.target.value).run())} />
          </label>
          <ToolbarButton {...buttonProps(labels.highlight)} active={editor.isActive("highlight")} onClick={() => run(() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run())}>H</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.clear)} onClick={() => run(() => editor.chain().focus().clearNodes().unsetAllMarks().run())}>×</ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton {...buttonProps(labels.undo)} onClick={() => run(() => editor.chain().focus().undo().run())}>↶</ToolbarButton>
          <ToolbarButton {...buttonProps(labels.redo)} onClick={() => run(() => editor.chain().focus().redo().run())}>↷</ToolbarButton>
        </div>
        {imageDialogOpen && <ImageInsertPanel labels={labels} mode={imageMode} source={imageSource} previewUrl={imagePreviewUrl} fileName={selectedFile?.name} alt={imageAlt} width={imageWidth} height={imageHeight} keepRatio={keepImageRatio} busy={imageBusy} error={imageError} fileInputRef={fileInputRef} onModeChange={setImageMode} onSourceChange={(source) => { setImageSource(source); setImageError(undefined); loadImageDimensions(source.trim()); }} onAltChange={setImageAlt} onWidthChange={(value) => changeImageDimension("width", value)} onHeightChange={(value) => changeImageDimension("height", value)} onKeepRatioChange={setKeepImageRatio} onChooseFile={() => fileInputRef.current?.click()} onFileChange={selectImageFile} onCancel={closeImageDialog} onInsert={() => void insertImage()} />}
        {parameters.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2"><span className="text-xs font-bold text-slate-500">{labels.parameter}</span>{parameters.map((parameter) => <button key={parameter.key} type="button" className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100" title={parameter.descriptionNl ?? parameter.labelNl ?? parameter.key} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().insertContent(`{{${parameter.key}}}`).run()}><Plus className="mr-1 inline h-3 w-3" />{parameter.key}</button>)}</div>}
        <EditorContent editor={editor} />
      </div>
      {helpText && <span className="mt-2 block text-xs text-slate-400">{helpText}</span>}
    </div>
  );
}

const MailImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("width"),
        renderHTML: (attributes: { width?: string | null }) => attributes.width ? { width: attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("height"),
        renderHTML: (attributes: { height?: string | null }) => attributes.height ? { height: attributes.height } : {},
      },
    };
  },
});

function ImageInsertPanel({
  labels,
  mode,
  source,
  previewUrl,
  fileName,
  alt,
  width,
  height,
  keepRatio,
  busy,
  error,
  fileInputRef,
  onModeChange,
  onSourceChange,
  onAltChange,
  onWidthChange,
  onHeightChange,
  onKeepRatioChange,
  onChooseFile,
  onFileChange,
  onCancel,
  onInsert,
}: {
  labels: EditorLabels;
  mode: "url" | "upload";
  source: string;
  previewUrl: string;
  fileName?: string;
  alt: string;
  width: number;
  height: number;
  keepRatio: boolean;
  busy: boolean;
  error?: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onModeChange: (mode: "url" | "upload") => void;
  onSourceChange: (value: string) => void;
  onAltChange: (value: string) => void;
  onWidthChange: (value: string) => void;
  onHeightChange: (value: string) => void;
  onKeepRatioChange: (value: boolean) => void;
  onChooseFile: () => void;
  onFileChange: (file: File | undefined) => void;
  onCancel: () => void;
  onInsert: () => void;
}) {
  return (
    <div className="border-b border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">{labels.image}</p>
        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onCancel} aria-label={labels.imageCancel} title={labels.imageCancel}>×</button>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === "url" ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600"}`} onClick={() => onModeChange("url")}>{labels.imageUrl}</button>
        <button type="button" className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === "upload" ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-600"}`} onClick={() => onModeChange("upload")}>{labels.imageUpload}</button>
      </div>
      {mode === "url" ? <label className="mt-3 block"><span className="block text-xs font-bold text-slate-600">{labels.imageUrl}</span><input className="field mt-1 w-full" value={source} onChange={(event) => onSourceChange(event.target.value)} placeholder="https://" /></label> : <div className="mt-3"><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => onFileChange(event.target.files?.[0])} /><button type="button" className="btn-secondary" onClick={onChooseFile}><span className="mr-2" aria-hidden="true">↑</span>{labels.imageFile}</button>{fileName && <span className="ml-2 text-xs text-slate-500">{fileName}</span>}</div>}
      {previewUrl && <img src={previewUrl} alt="" className="mt-3 max-h-32 max-w-full rounded-lg border border-slate-200 object-contain" />}
      <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="block"><span className="block text-xs font-bold text-slate-600">{labels.imageAltPrompt}</span><input className="field mt-1 w-full" value={alt} onChange={(event) => onAltChange(event.target.value)} /></label><label className="block"><span className="block text-xs font-bold text-slate-600">{labels.imageWidth}</span><input className="field mt-1 w-full" type="number" min="1" max="2400" value={width} onChange={(event) => onWidthChange(event.target.value)} /></label><label className="block"><span className="block text-xs font-bold text-slate-600">{labels.imageHeight}</span><input className="field mt-1 w-full" type="number" min="1" max="2400" value={height} onChange={(event) => onHeightChange(event.target.value)} /></label></div>
      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={keepRatio} onChange={(event) => onKeepRatioChange(event.target.checked)} />{labels.imageKeepRatio}</label>
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
      <div className="mt-3 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel}>{labels.imageCancel}</button><button type="button" className="btn-primary" disabled={busy} onClick={onInsert}>{busy ? labels.imageUploading : labels.imageInsert}</button></div>
    </div>
  );
}

function ToolbarButton({ active, children, onClick, ...props }: ComponentProps<"button"> & { active?: boolean }) {
  return <button {...props} onClick={onClick} className={`${props.className ?? ""} ${active ? "bg-brand-100 text-brand-800" : ""}`}>{children}</button>;
}

function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />;
}
