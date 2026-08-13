from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = Path(__file__).with_name("build-fieldforce-complete-manual.py")
SOURCE_SPEC = importlib.util.spec_from_file_location("fieldforce_manual_source", SOURCE_PATH)
if SOURCE_SPEC is None or SOURCE_SPEC.loader is None:
    raise RuntimeError(f"Kan de gedeelde handleidingbron niet laden: {SOURCE_PATH}")
source = importlib.util.module_from_spec(SOURCE_SPEC)
SOURCE_SPEC.loader.exec_module(source)

OUTPUT_FILE = ROOT / "output" / "docx" / "MExT_FieldForce_Coaching_Handleiding.docx"


class CoachingManualBuilder(source.ManualBuilder):
    """Standalone wrapper around the maintained Coaching chapter."""

    def title_page(self) -> None:
        logo = ROOT / "public" / "assets" / "fieldforce-logo.png"
        if logo.exists():
            p = self.doc.add_paragraph()
            p.alignment = source.WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run()
            shape = run.add_picture(str(logo), width=source.Inches(2.7))
            shape._inline.docPr.set("descr", "Logo van MExT FieldForce")
            p.paragraph_format.space_after = source.Pt(72)

        p = self.doc.add_paragraph()
        p.alignment = source.WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = source.Pt(16)
        r = p.add_run("MODULEHANDLEIDING")
        source.set_run_font(r, size=10, color=source.AMBER, bold=True)

        p = self.doc.add_paragraph()
        p.alignment = source.WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = source.Pt(10)
        r = p.add_run("MExT FieldForce")
        source.set_run_font(r, size=30, color=source.NAVY, bold=True)

        p = self.doc.add_paragraph()
        p.alignment = source.WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = source.Pt(8)
        r = p.add_run("Coaching")
        source.set_run_font(r, size=21, color=source.BLUE, bold=True)

        p = self.doc.add_paragraph()
        p.alignment = source.WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = source.Pt(56)
        r = p.add_run("Gebruikershandleiding en procesboek")
        source.set_run_font(r, size=12, color=source.MUTED, italic=True)

        meta = self.doc.add_table(rows=4, cols=2)
        source.set_table_geometry(meta, [2700, 6660])
        data = [
            ("Versie", "1.0"),
            ("Documentdatum", "13 augustus 2026"),
            ("Doelgroep", "Vertegenwoordigers, coaches, verkoopleiders, management en beheerders"),
            ("Status", "Interne handleiding op basis van de actuele broncode en goedgekeurde Coaching-beslissingen"),
        ]
        for row, (label, value) in zip(meta.rows, data):
            source.set_cell_shading(row.cells[0], source.LIGHT_BLUE)
            rp = row.cells[0].paragraphs[0]
            rr = rp.add_run(label)
            source.set_run_font(rr, size=9.5, color=source.NAVY, bold=True)
            vp = row.cells[1].paragraphs[0]
            vr = vp.add_run(value)
            source.set_run_font(vr, size=9.5, color=source.INK)

        p = self.doc.add_paragraph()
        p.alignment = source.WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = source.Pt(34)
        r = p.add_run("INTERN GEBRUIK · screenshots kunnen testdata en echte gebruikersnamen bevatten")
        source.set_run_font(r, size=8.5, color=source.RED, bold=True)
        self.doc.add_page_break()

    def h1(self, text: str) -> None:
        super().h1(text.replace("3. Coaching — complete gebruikershandleiding", "1. Coaching — complete gebruikershandleiding"))

    def h2(self, text: str) -> None:
        if text.startswith("3."):
            text = "1." + text[2:]
        super().h2(text)


def build() -> Path:
    source.save_diagrams()
    source.OUTPUT_FILE = OUTPUT_FILE
    builder = CoachingManualBuilder()
    builder.doc.core_properties.title = "MExT FieldForce - Coaching handleiding"
    builder.doc.core_properties.subject = "Gebruikershandleiding en procesboek voor de Coaching-module"
    builder.doc.core_properties.keywords = "FieldForce, Coaching, handleiding, procesboek"
    for section in builder.doc.sections:
        header = section.header.paragraphs[0]
        header.clear()
        run = header.add_run("MExT FieldForce  |  Coaching handleiding")
        source.set_run_font(run, size=8.5, color=source.MUTED, bold=True)
    builder.title_page()
    builder.h1("Inhoud en navigatie")
    builder.p("Deze zelfstandige modulehandleiding beschrijft de actuele Coaching-functionaliteit, de belangrijkste gebruikersflows, scope- en levenscyclusregels en de onderdelen die nog niet zakelijk zijn gedefinieerd.")
    builder.toc()
    builder.page_break()
    source.add_coaching(builder)
    builder.save()
    return OUTPUT_FILE


if __name__ == "__main__":
    print(build())
