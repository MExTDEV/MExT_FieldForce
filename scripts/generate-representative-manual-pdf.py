from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "user" / "HANDLEIDING_VERTEGENWOORDIGER.md"
OUTPUT = ROOT / "output" / "pdf" / "MExT-FieldForce-Handleiding-Vertegenwoordiger.pdf"
LOGO = ROOT / "public" / "assets" / "fieldforce-logo-tight.png"

PAGE_WIDTH, PAGE_HEIGHT = A4
NAVY = colors.HexColor("#003B83")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5C667A")
PALE_BLUE = colors.HexColor("#EDF5FF")
GOLD = colors.HexColor("#E8B06A")
LINE = colors.HexColor("#D8E0EA")
WHITE = colors.white


def register_fonts() -> tuple[str, str]:
    regular = next(
        (path for path in [Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/calibri.ttf")] if path.exists()),
        None,
    )
    bold = next(
        (path for path in [Path("C:/Windows/Fonts/arialbd.ttf"), Path("C:/Windows/Fonts/calibrib.ttf")] if path.exists()),
        None,
    )
    if regular and bold:
        pdfmetrics.registerFont(TTFont("ManualSans", str(regular)))
        pdfmetrics.registerFont(TTFont("ManualSans-Bold", str(bold)))
        return "ManualSans", "ManualSans-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def escape_markup(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline_markup(text: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escape_markup(text.strip()))


def cover_page(canvas, _doc) -> None:
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#0B4F98"))
    canvas.rect(0, 156 * mm, PAGE_WIDTH, 15 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 0, PAGE_WIDTH, 7 * mm, fill=1, stroke=0)
    canvas.restoreState()


def content_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_HEIGHT - 13 * mm, PAGE_WIDTH, 13 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont(FONT_BOLD, 8.5)
    canvas.drawString(18 * mm, PAGE_HEIGHT - 8.2 * mm, "MExT FieldForce")
    canvas.setFont(FONT, 8.5)
    canvas.drawRightString(PAGE_WIDTH - 18 * mm, PAGE_HEIGHT - 8.2 * mm, "Handleiding Vertegenwoordiger")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 13 * mm, PAGE_WIDTH - 18 * mm, 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 8)
    canvas.drawString(18 * mm, 8.5 * mm, "Versie 13 juli 2026")
    canvas.drawRightString(PAGE_WIDTH - 18 * mm, 8.5 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def build_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "CoverKicker", parent=sample["Normal"], fontName=FONT_BOLD,
            fontSize=10, leading=13, textColor=GOLD, spaceAfter=7 * mm,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=sample["Title"], fontName=FONT_BOLD,
            fontSize=30, leading=34, textColor=WHITE, spaceAfter=6 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle", parent=sample["Normal"], fontName=FONT,
            fontSize=13, leading=19, textColor=colors.HexColor("#DDEAFF"), spaceAfter=6 * mm,
        ),
        "h1": ParagraphStyle(
            "H1", parent=sample["Heading1"], fontName=FONT_BOLD,
            fontSize=17, leading=21, textColor=NAVY,
            spaceBefore=4 * mm, spaceAfter=3 * mm, keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body", parent=sample["BodyText"], fontName=FONT,
            fontSize=9.5, leading=14.2, textColor=INK, spaceAfter=2.4 * mm,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=sample["BodyText"], fontName=FONT,
            fontSize=9.3, leading=13.8, textColor=INK,
            leftIndent=5 * mm, firstLineIndent=-3.5 * mm, bulletIndent=1.5 * mm,
            bulletFontName=FONT, spaceAfter=1.2 * mm,
        ),
        "number": ParagraphStyle(
            "Number", parent=sample["BodyText"], fontName=FONT,
            fontSize=9.3, leading=13.8, textColor=INK,
            leftIndent=7 * mm, firstLineIndent=-5.5 * mm, bulletIndent=1 * mm,
            bulletFontName=FONT, spaceAfter=1.3 * mm,
        ),
        "toc": ParagraphStyle(
            "Toc", parent=sample["BodyText"], fontName=FONT,
            fontSize=9.2, leading=13, textColor=INK,
        ),
        "small": ParagraphStyle(
            "Small", parent=sample["BodyText"], fontName=FONT,
            fontSize=8.5, leading=12, textColor=MUTED,
        ),
        "cover_meta": ParagraphStyle(
            "CoverMeta", parent=sample["BodyText"], fontName=FONT_BOLD,
            fontSize=8.5, leading=12, textColor=WHITE,
        ),
        "callout": ParagraphStyle(
            "Callout", parent=sample["BodyText"], fontName=FONT,
            fontSize=9.3, leading=14, textColor=NAVY,
        ),
    }


def parse_sections(source: str) -> list[tuple[str, list[tuple[str, str]]]]:
    sections: list[tuple[str, list[tuple[str, str]]]] = []
    current_title = ""
    blocks: list[tuple[str, str]] = []
    paragraph: list[str] = []

    def flush_paragraph() -> None:
        if paragraph:
            blocks.append(("paragraph", " ".join(paragraph).strip()))
            paragraph.clear()

    for raw_line in source.splitlines():
        line = raw_line.rstrip()
        if line.startswith("# ") or line.startswith("Versie:"):
            continue
        if line.startswith("## "):
            flush_paragraph()
            if current_title:
                sections.append((current_title, blocks))
            current_title = line[3:].strip()
            blocks = []
        elif re.match(r"^\d+\.\s", line):
            flush_paragraph()
            blocks.append(("number", line))
        elif line.startswith("- "):
            flush_paragraph()
            blocks.append(("bullet", line[2:].strip()))
        elif not line.strip():
            flush_paragraph()
        else:
            paragraph.append(line.strip())
    flush_paragraph()
    if current_title:
        sections.append((current_title, blocks))
    return sections


def make_cover(styles: dict[str, ParagraphStyle]):
    logo = Image(str(LOGO), width=122 * mm, height=48.5 * mm)
    logo.hAlign = "LEFT"
    metadata = Table(
        [
            [Paragraph("ROL", styles["cover_meta"]), Paragraph("VERTEGENWOORDIGER", styles["cover_meta"])],
            [Paragraph("VERSIE", styles["cover_meta"]), Paragraph("13 JULI 2026", styles["cover_meta"])],
        ],
        colWidths=[30 * mm, 68 * mm],
    )
    metadata.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0B4F98")),
        ("TEXTCOLOR", (0, 0), (-1, -1), WHITE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, colors.HexColor("#5D8FC3")),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4 * mm),
    ]))
    return [
        Spacer(1, 12 * mm), logo, Spacer(1, 31 * mm),
        Paragraph("GEBRUIKERSHANDLEIDING", styles["cover_kicker"]),
        Paragraph("Vertegenwoordiger", styles["cover_title"]),
        Paragraph(
            "Je praktische gids voor planning, Begeleidingen, Actiepunten, Hulpaanvragen en gedeelde Contactmomentverslagen.",
            styles["cover_subtitle"],
        ),
        Spacer(1, 17 * mm), metadata, Spacer(1, 26 * mm),
        Paragraph("MExT FieldForce", styles["cover_kicker"]),
        Paragraph("Grow. Coach. Perform.", styles["cover_subtitle"]),
        PageBreak(),
    ]


def make_toc(sections, styles):
    rows = []
    for title, _ in sections:
        number, _, label = title.partition(". ")
        rows.append([
            Paragraph(f"<b>{escape_markup(number)}</b>", styles["toc"]),
            Paragraph(escape_markup(label or title), styles["toc"]),
        ])
    table = Table(rows, colWidths=[10 * mm, 145 * mm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    return [
        Paragraph("Inhoud", styles["h1"]),
        Paragraph(
            "Gebruik deze handleiding als dagelijkse werkgids. De zichtbare onderdelen kunnen verschillen wanneer modules of persoonlijke rechten anders zijn ingesteld.",
            styles["body"],
        ),
        Spacer(1, 2 * mm), table, PageBreak(),
    ]


def make_story(sections, styles):
    story = make_cover(styles)
    story.extend(make_toc(sections, styles))
    for index, (title, blocks) in enumerate(sections):
        story.extend([
            Paragraph(inline_markup(title), styles["h1"]),
            HRFlowable(width="100%", thickness=0.6, color=GOLD, spaceAfter=3 * mm),
        ])
        for kind, content in blocks:
            if kind == "bullet":
                story.append(Paragraph(inline_markup(content), styles["bullet"], bulletText="-"))
            elif kind == "number":
                match = re.match(r"^(\d+)\.\s+(.*)$", content)
                if match:
                    story.append(Paragraph(inline_markup(match.group(2)), styles["number"], bulletText=f"{match.group(1)}."))
            else:
                text = inline_markup(content).replace("  ", "<br/>")
                if content.startswith("**") and "**" in content[2:]:
                    callout = Table([[Paragraph(text, styles["callout"])]], colWidths=[158 * mm])
                    callout.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#B9D5F2")),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                    ]))
                    story.extend([callout, Spacer(1, 1.5 * mm)])
                else:
                    story.append(Paragraph(text, styles["body"]))
        story.append(Spacer(1, 3 * mm))
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sections = parse_sections(SOURCE.read_text(encoding="utf-8"))
    styles = build_styles()
    doc = BaseDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=17 * mm,
        title="MExT FieldForce - Handleiding voor de Vertegenwoordiger",
        author="MExT FieldForce",
        subject="Gebruikershandleiding voor de rol Vertegenwoordiger",
    )
    cover_frame = Frame(22 * mm, 15 * mm, PAGE_WIDTH - 44 * mm, PAGE_HEIGHT - 30 * mm, id="cover")
    content_frame = Frame(18 * mm, 17 * mm, PAGE_WIDTH - 36 * mm, PAGE_HEIGHT - 37 * mm, id="content")
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=cover_page, autoNextPageTemplate="Content"),
        PageTemplate(id="Content", frames=[content_frame], onPage=content_page),
    ])
    doc.build(make_story(sections, styles))
    print(OUTPUT)


if __name__ == "__main__":
    main()
