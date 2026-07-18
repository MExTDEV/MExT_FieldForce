from __future__ import annotations

from pathlib import Path
import importlib.util
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "docs" / "manuals" / "assets"
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_FILE = OUTPUT_DIR / "MExT_FieldForce_Complete_Handleiding.pdf"

SOURCE_PATH = Path(__file__).with_name("build-fieldforce-complete-manual.py")
SOURCE_SPEC = importlib.util.spec_from_file_location("fieldforce_manual_source", SOURCE_PATH)
if SOURCE_SPEC is None or SOURCE_SPEC.loader is None:
    raise RuntimeError(f"Kan de gedeelde handleidingbron niet laden: {SOURCE_PATH}")
source = importlib.util.module_from_spec(SOURCE_SPEC)
SOURCE_SPEC.loader.exec_module(source)


def color(value: str) -> colors.Color:
    return colors.HexColor("#" + value)


def register_fonts() -> tuple[str, str, str]:
    regular = Path("C:/Windows/Fonts/calibri.ttf")
    bold = Path("C:/Windows/Fonts/calibrib.ttf")
    italic = Path("C:/Windows/Fonts/calibrii.ttf")
    if regular.exists() and bold.exists() and italic.exists():
        pdfmetrics.registerFont(TTFont("FieldForce", str(regular)))
        pdfmetrics.registerFont(TTFont("FieldForce-Bold", str(bold)))
        pdfmetrics.registerFont(TTFont("FieldForce-Italic", str(italic)))
        pdfmetrics.registerFontFamily(
            "FieldForce",
            normal="FieldForce",
            bold="FieldForce-Bold",
            italic="FieldForce-Italic",
            boldItalic="FieldForce-Bold",
        )
        return "FieldForce", "FieldForce-Bold", "FieldForce-Italic"
    return "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"


REGULAR, BOLD, ITALIC = register_fonts()


class NumberedCanvasDoc(BaseDocTemplate):
    def __init__(self, filename: str, **kwargs) -> None:
        super().__init__(filename, **kwargs)
        frame = source_frame(self)
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=self.draw_page)])
        self._heading_counter = 0

    def beforeDocument(self) -> None:
        self._heading_counter = 0

    def draw_page(self, canvas, doc) -> None:
        if doc.page <= 1:
            return
        canvas.saveState()
        canvas.setFont(BOLD, 8.2)
        canvas.setFillColor(color(source.MUTED))
        canvas.drawString(doc.leftMargin, letter[1] - 0.52 * inch, "MExT FieldForce  |  Complete handleiding")
        canvas.setStrokeColor(color(source.LIGHT_BLUE))
        canvas.line(doc.leftMargin, letter[1] - 0.60 * inch, letter[0] - doc.rightMargin, letter[1] - 0.60 * inch)
        canvas.setFont(REGULAR, 8.2)
        canvas.drawCentredString(letter[0] / 2, 0.47 * inch, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable: Flowable) -> None:
        if not isinstance(flowable, Paragraph):
            return
        name = flowable.style.name
        if name not in {"FF-H1", "FF-H2", "FF-H3"}:
            return
        level = {"FF-H1": 0, "FF-H2": 1, "FF-H3": 2}[name]
        text = flowable.getPlainText()
        self._heading_counter += 1
        key = f"heading-{self._heading_counter}"
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
        self.notify("TOCEntry", (level, text, self.page, key))


def source_frame(doc: BaseDocTemplate):
    from reportlab.platypus import Frame

    return Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="body",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )


class PdfManualBuilder:
    def __init__(self) -> None:
        self.story: list[Flowable] = []
        self.number_counter = 0
        self.styles = self._styles()

    def _styles(self) -> dict[str, ParagraphStyle]:
        sample = getSampleStyleSheet()
        return {
            "body": ParagraphStyle(
                "FF-Body", parent=sample["BodyText"], fontName=REGULAR,
                fontSize=9.5, leading=12.2, textColor=color(source.INK),
                spaceAfter=5.5, splitLongWords=True,
            ),
            "h1": ParagraphStyle(
                "FF-H1", parent=sample["Heading1"], fontName=BOLD,
                fontSize=16, leading=19, textColor=color(source.MID_BLUE),
                spaceBefore=18, spaceAfter=9, keepWithNext=True,
            ),
            "h2": ParagraphStyle(
                "FF-H2", parent=sample["Heading2"], fontName=BOLD,
                fontSize=13, leading=16, textColor=color(source.MID_BLUE),
                spaceBefore=13, spaceAfter=6, keepWithNext=True,
            ),
            "h3": ParagraphStyle(
                "FF-H3", parent=sample["Heading3"], fontName=BOLD,
                fontSize=11.5, leading=14, textColor=color(source.DARK_BLUE),
                spaceBefore=10, spaceAfter=4, keepWithNext=True,
            ),
            "caption": ParagraphStyle(
                "FF-Caption", parent=sample["BodyText"], fontName=ITALIC,
                fontSize=8.2, leading=10, alignment=TA_CENTER,
                textColor=color(source.MUTED), spaceBefore=3, spaceAfter=8,
            ),
            "bullet": ParagraphStyle(
                "FF-Bullet", parent=sample["BodyText"], fontName=REGULAR,
                fontSize=9.4, leading=12, leftIndent=15, firstLineIndent=-9,
                bulletIndent=3, textColor=color(source.INK), spaceAfter=3.5,
            ),
            "code": ParagraphStyle(
                "FF-Code", parent=sample["Code"], fontName="Courier",
                fontSize=7.5, leading=9.5, leftIndent=14,
                textColor=color(source.INK), spaceAfter=5,
            ),
            "cover-kicker": ParagraphStyle(
                "FF-Cover-Kicker", parent=sample["BodyText"], fontName=BOLD,
                fontSize=10, leading=12, alignment=TA_CENTER,
                textColor=color(source.AMBER), spaceAfter=14,
            ),
            "cover-title": ParagraphStyle(
                "FF-Cover-Title", parent=sample["Title"], fontName=BOLD,
                fontSize=30, leading=34, alignment=TA_CENTER,
                textColor=color(source.NAVY), spaceAfter=8,
            ),
            "cover-modules": ParagraphStyle(
                "FF-Cover-Modules", parent=sample["Title"], fontName=BOLD,
                fontSize=17, leading=21, alignment=TA_CENTER,
                textColor=color(source.BLUE), spaceAfter=8,
            ),
            "cover-subtitle": ParagraphStyle(
                "FF-Cover-Subtitle", parent=sample["BodyText"], fontName=ITALIC,
                fontSize=12, leading=15, alignment=TA_CENTER,
                textColor=color(source.MUTED), spaceAfter=30,
            ),
        }

    def _reset_numbering(self) -> None:
        self.number_counter = 0

    def title_page(self) -> None:
        self.story.append(Spacer(1, 0.55 * inch))
        logo = ROOT / "public" / "assets" / "fieldforce-logo.png"
        if logo.exists():
            image = Image(str(logo), width=2.7 * inch, height=0.85 * inch)
            image.hAlign = "CENTER"
            self.story.extend([image, Spacer(1, 0.55 * inch)])
        self.story.append(Paragraph("PRODUCT- EN PROCESHANDLEIDING", self.styles["cover-kicker"]))
        self.story.append(Paragraph("MExT FieldForce", self.styles["cover-title"]))
        self.story.append(Paragraph("Coaching · SalesDay · Contract", self.styles["cover-modules"]))
        self.story.append(Paragraph("Gebruikershandleiding, procesboek en technisch framework", self.styles["cover-subtitle"]))
        meta = [
            ["Versie", "1.0"],
            ["Documentdatum", "17 juli 2026"],
            ["Doelgroep", "Vertegenwoordigers, verkoopleiders, management, backoffice, beheerders en ontwikkelaars"],
            ["Status", "Interne handleiding op basis van de broncode en goedgekeurde modulebeslissingen"],
        ]
        table = Table(
            [[Paragraph(f"<b>{escape(a)}</b>", self.styles["body"]), Paragraph(escape(b), self.styles["body"])] for a, b in meta],
            colWidths=[1.45 * inch, 5.05 * inch],
            hAlign="CENTER",
        )
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), color(source.LIGHT_BLUE)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.35, color("CBD5E1")),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        self.story.extend([table, Spacer(1, 0.38 * inch)])
        notice = Paragraph(
            "<b>INTERN GEBRUIK · screenshots kunnen testdata en echte gebruikersnamen bevatten</b>",
            ParagraphStyle("FF-Cover-Notice", parent=self.styles["body"], alignment=TA_CENTER, textColor=color(source.RED), fontSize=8.5),
        )
        self.story.extend([notice, PageBreak()])

    def h1(self, text: str) -> None:
        self._reset_numbering()
        self.story.append(Paragraph(escape(text), self.styles["h1"]))

    def h2(self, text: str) -> None:
        self._reset_numbering()
        self.story.append(Paragraph(escape(text), self.styles["h2"]))

    def h3(self, text: str) -> None:
        self._reset_numbering()
        self.story.append(Paragraph(escape(text), self.styles["h3"]))

    def p(self, text: str, bold_prefix: str | None = None) -> None:
        self._reset_numbering()
        safe = escape(text)
        if bold_prefix and text.startswith(bold_prefix):
            prefix = escape(bold_prefix)
            safe = f"<b>{prefix}</b>{escape(text[len(bold_prefix):])}"
        self.story.append(Paragraph(safe, self.styles["body"]))

    def bullet(self, text: str) -> None:
        self._reset_numbering()
        self.story.append(Paragraph(escape(text), self.styles["bullet"], bulletText="•"))

    def numbered(self, text: str) -> None:
        self.number_counter += 1
        self.story.append(Paragraph(escape(text), self.styles["bullet"], bulletText=f"{self.number_counter}."))

    def callout(self, title: str, text: str, tone: str = "info") -> None:
        self._reset_numbering()
        palette = {
            "info": (source.PALE_BLUE, source.BLUE),
            "success": (source.PALE_GREEN, source.GREEN),
            "warning": (source.PALE_AMBER, source.AMBER),
            "risk": (source.PALE_RED, source.RED),
        }
        fill, accent = palette[tone]
        paragraph = Paragraph(
            f'<font color="#{accent}"><b>{escape(title)}</b></font><br/>{escape(text)}',
            self.styles["body"],
        )
        table = Table([[paragraph]], colWidths=[6.48 * inch], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), color(fill)),
            ("BOX", (0, 0), (-1, -1), 0.8, color(accent)),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        self.story.extend([table, Spacer(1, 5)])

    def table(self, headers: list[str], rows: list[list[str]], widths: list[int]) -> None:
        self._reset_numbering()
        scale = 6.48 * inch / sum(widths)
        col_widths = [value * scale for value in widths]
        data = [[Paragraph(f"<b>{escape(str(value))}</b>", self.styles["body"]) for value in headers]]
        data.extend([[Paragraph(escape(str(value)), self.styles["body"]) for value in row] for row in rows])
        table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), color(source.LIGHT_BLUE)),
            ("TEXTCOLOR", (0, 0), (-1, 0), color(source.NAVY)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.35, color("B7C4D3")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        self.story.extend([table, Spacer(1, 5)])

    def screenshot(self, filename: str, caption: str, alt: str, width: float = 6.25) -> None:
        self._reset_numbering()
        path = ASSET_DIR / filename
        if not path.exists():
            self.callout("Screenshot niet beschikbaar", f"Het bestand {filename} kon niet worden opgenomen.", "warning")
            return
        with PILImage.open(path) as source_image:
            ratio = source_image.height / source_image.width
        image = Image(str(path), width=width * inch, height=width * inch * ratio)
        image.hAlign = "CENTER"
        block = KeepTogether([image, Paragraph(escape(caption), self.styles["caption"])])
        self.story.append(block)

    def code(self, text: str) -> None:
        self._reset_numbering()
        safe = escape(text).replace("\n", "<br/>")
        self.story.append(Paragraph(safe, self.styles["code"]))

    def page_break(self) -> None:
        self._reset_numbering()
        self.story.append(PageBreak())

    def toc(self) -> None:
        toc = TableOfContents()
        toc.levelStyles = [
            ParagraphStyle("TOC-1", fontName=BOLD, fontSize=9.5, leading=13, leftIndent=0, firstLineIndent=0, spaceBefore=3, textColor=color(source.NAVY)),
            ParagraphStyle("TOC-2", fontName=REGULAR, fontSize=8.8, leading=11.5, leftIndent=14, firstLineIndent=0, spaceBefore=1, textColor=color(source.INK)),
            ParagraphStyle("TOC-3", fontName=REGULAR, fontSize=8.2, leading=10.5, leftIndent=28, firstLineIndent=0, spaceBefore=0, textColor=color(source.MUTED)),
        ]
        self.story.append(toc)

    def save(self) -> Path:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        doc = NumberedCanvasDoc(
            str(OUTPUT_FILE), pagesize=letter,
            leftMargin=inch, rightMargin=inch, topMargin=0.78 * inch, bottomMargin=0.72 * inch,
            title="MExT FieldForce - Complete handleiding",
            author="MExT FieldForce",
            subject="Gebruikershandleiding en technisch framework voor Coaching, SalesDay en Contract",
        )
        doc.multiBuild(self.story)
        return OUTPUT_FILE


def build() -> Path:
    source.save_diagrams()
    builder = PdfManualBuilder()
    builder.title_page()
    builder.h1("Inhoud en navigatie")
    builder.p("Deze inhoudsopgave is klikbaar. Gebruik daarnaast de bladwijzers van de PDF-lezer om rechtstreeks naar hoofdstukken en deelprocessen te springen.")
    builder.toc()
    builder.page_break()
    source.add_intro(builder)
    source.add_platform(builder)
    source.add_coaching(builder)
    source.add_salesday(builder)
    source.add_contract(builder)
    source.add_management(builder)
    source.add_technical(builder)
    source.add_operations(builder)
    source.add_troubleshooting(builder)
    source.add_framework(builder)
    source.add_appendices(builder)
    return builder.save()


if __name__ == "__main__":
    print(build())
