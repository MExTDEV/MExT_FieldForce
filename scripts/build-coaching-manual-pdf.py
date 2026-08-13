from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = Path(__file__).with_name("build-fieldforce-complete-manual-pdf.py")
SOURCE_SPEC = importlib.util.spec_from_file_location("fieldforce_manual_pdf_source", SOURCE_PATH)
if SOURCE_SPEC is None or SOURCE_SPEC.loader is None:
    raise RuntimeError(f"Kan de gedeelde PDF-bron niet laden: {SOURCE_PATH}")
source = importlib.util.module_from_spec(SOURCE_SPEC)
SOURCE_SPEC.loader.exec_module(source)

OUTPUT_FILE = ROOT / "output" / "pdf" / "MExT_FieldForce_Coaching_Handleiding.pdf"


class CoachingPdfBuilder(source.PdfManualBuilder):
    def title_page(self) -> None:
        self.story.append(source.Spacer(1, 0.32 * source.inch))
        logo = ROOT / "public" / "assets" / "fieldforce-logo.png"
        if logo.exists():
            self.story.append(source.Image(str(logo), width=2.7 * source.inch, height=0.75 * source.inch))
            self.story.append(source.Spacer(1, 0.65 * source.inch))
        self.story.append(source.Paragraph("MODULEHANDLEIDING", self.styles["cover-kicker"]))
        self.story.append(source.Paragraph("MExT FieldForce", self.styles["cover-title"]))
        self.story.append(source.Paragraph("Coaching", self.styles["cover-modules"]))
        self.story.append(source.Paragraph("Gebruikershandleiding en procesboek", self.styles["cover-subtitle"]))
        self.story.append(source.Spacer(1, 0.45 * source.inch))
        data = [
            ["Versie", "1.0"],
            ["Documentdatum", "13 augustus 2026"],
            ["Doelgroep", "Vertegenwoordigers, coaches, verkoopleiders, management en beheerders"],
            ["Status", "Interne handleiding op basis van de actuele broncode en goedgekeurde Coaching-beslissingen"],
        ]
        table = source.Table(data, colWidths=[1.35 * source.inch, 5.85 * source.inch])
        table.setStyle(source.TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), source.color(source.source.LIGHT_BLUE)),
            ("TEXTCOLOR", (0, 0), (0, -1), source.color(source.source.NAVY)),
            ("TEXTCOLOR", (1, 0), (1, -1), source.color(source.source.INK)),
            ("FONTNAME", (0, 0), (0, -1), source.BOLD),
            ("FONTNAME", (1, 0), (1, -1), source.REGULAR),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.35, source.color(source.source.MID_BLUE)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        self.story.append(table)
        self.story.append(source.Spacer(1, 0.35 * source.inch))
        self.story.append(source.Paragraph("INTERN GEBRUIK · screenshots kunnen testdata en echte gebruikersnamen bevatten", self.styles["cover-subtitle"]))
        self.story.append(source.PageBreak())

    def h1(self, text: str) -> None:
        super().h1(text.replace("3. Coaching — complete gebruikershandleiding", "1. Coaching — complete gebruikershandleiding"))

    def h2(self, text: str) -> None:
        if text.startswith("3."):
            text = "1." + text[2:]
        super().h2(text)

    def save(self) -> Path:
        source.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        doc = CoachingNumberedCanvasDoc(
            str(OUTPUT_FILE), pagesize=source.letter,
            leftMargin=source.inch, rightMargin=source.inch,
            topMargin=0.78 * source.inch, bottomMargin=0.72 * source.inch,
            title="MExT FieldForce - Coaching handleiding",
            author="MExT FieldForce",
            subject="Gebruikershandleiding en procesboek voor de Coaching-module",
        )
        doc.multiBuild(self.story)
        return OUTPUT_FILE


class CoachingNumberedCanvasDoc(source.NumberedCanvasDoc):
    def draw_page(self, canvas, doc) -> None:
        if doc.page <= 1:
            return
        canvas.saveState()
        canvas.setFont(source.BOLD, 8.2)
        canvas.setFillColor(source.color(source.source.MUTED))
        canvas.drawString(doc.leftMargin, source.letter[1] - 0.52 * source.inch, "MExT FieldForce  |  Coaching handleiding")
        canvas.setStrokeColor(source.color(source.source.LIGHT_BLUE))
        canvas.line(doc.leftMargin, source.letter[1] - 0.60 * source.inch, source.letter[0] - doc.rightMargin, source.letter[1] - 0.60 * source.inch)
        canvas.setFont(source.REGULAR, 8.2)
        canvas.drawCentredString(source.letter[0] / 2, 0.47 * source.inch, str(doc.page))
        canvas.restoreState()


def build() -> Path:
    source.source.save_diagrams()
    source.OUTPUT_FILE = OUTPUT_FILE
    builder = CoachingPdfBuilder()
    builder.title_page()
    builder.h1("Inhoud en navigatie")
    builder.p("Deze zelfstandige modulehandleiding beschrijft de actuele Coaching-functionaliteit, de belangrijkste gebruikersflows, scope- en levenscyclusregels en de onderdelen die nog niet zakelijk zijn gedefinieerd.")
    builder.toc()
    builder.page_break()
    source.source.add_coaching(builder)
    builder.save()
    return OUTPUT_FILE


if __name__ == "__main__":
    print(build())
