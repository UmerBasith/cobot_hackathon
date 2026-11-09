r"""
make_doc.py - turn a simple Markdown file into a clean, designed Word report.

    .venv\Scripts\python tools\make_doc.py round1\doc\report.md round1\doc\Ctrl.Alt.Elite_Round1_Report.docx
    then: powershell -ExecutionPolicy Bypass -File tools\export_office.ps1 -File <the .docx>   (PDF + page count)

Markdown supported (keep it simple):
  First block = cover info between two '---' lines:
      ---
      title: NovaSense
      subtitle: Predicting machine failures before they happen
      team: Ctrl.Alt.Elite
      members: Umer Basith, Muizzur Rahman
      event: Cobot-Ex Hackathon 2026 · Round 1
      brand: #6D4AFF
      ---
  # Heading 1   ## Heading 2   ### Heading 3
  Paragraph text with **bold**, *italic* and `code`.
  - bullet            1. numbered
  > Callout / key insight box
  | table | with | header |   (second line |---|---| is the separator)
  ![Caption text](path/to/image.png){width=6}     (width in inches, default 6; path relative to the .md)
  ```  code block  ```
  [pagebreak]
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

from docx import Document

from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

BODY_FONT = "Segoe UI"
HEAD_FONT = "Segoe UI Semibold"
MONO_FONT = "Consolas"
TEXT = RGBColor(0x1F, 0x23, 0x3A)
MUTED = RGBColor(0x5B, 0x62, 0x80)


def rgb(h: str) -> RGBColor:
    return RGBColor.from_string(h.lstrip("#").upper())


# Word is strict about the ORDER of child elements (wrong order = "unreadable
# content" dialog). These lists say which siblings must come AFTER the element.
_PPR_AFTER_PBDR = ["shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct",
                   "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind",
                   "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment",
                   "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"]
_PPR_AFTER_SHD = _PPR_AFTER_PBDR[1:]
_TCPR_AFTER_SHD = ["noWrap", "tcMar", "textDirection", "tcFitText", "vAlign", "hideMark"]
_TBLPR_AFTER_BORDERS = ["shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription"]


def insert_ordered(parent, child, after_names: list[str]):
    """Insert child before the first existing sibling that must come after it; replace an old copy."""
    for old in parent.findall(child.tag):
        parent.remove(old)
    for el in parent:
        local = el.tag.split("}")[-1]
        if local in after_names:
            el.addprevious(child)
            return child
    parent.append(child)
    return child


def shade(el, hex_fill: str):
    """Background colour for a paragraph (pass p._p) or table cell (pass cell._tc)."""
    is_para = hasattr(el, "get_or_add_pPr")
    pr = el.get_or_add_pPr() if is_para else el.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill.lstrip("#"))
    insert_ordered(pr, shd, _PPR_AFTER_SHD if is_para else _TCPR_AFTER_SHD)


def para_border(p, color: str, side: str = "left", size: int = 24):
    pPr = p._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    b = OxmlElement(f"w:{side}")
    b.set(qn("w:val"), "single")
    b.set(qn("w:sz"), str(size))
    b.set(qn("w:space"), "8")
    b.set(qn("w:color"), color.lstrip("#"))
    bdr.append(b)
    insert_ordered(pPr, bdr, _PPR_AFTER_PBDR)


def add_field(run, instr: str):
    f1 = OxmlElement("w:fldChar"); f1.set(qn("w:fldCharType"), "begin")
    it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = instr
    f2 = OxmlElement("w:fldChar"); f2.set(qn("w:fldCharType"), "end")
    run._r.append(f1); run._r.append(it); run._r.append(f2)


INLINE = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)")


def add_inline(p, text: str, size=10.5, color=TEXT, bold=False):
    for part in INLINE.split(text):
        if not part:
            continue
        r = p.add_run()
        if part.startswith("**"):
            r.text, r.bold = part[2:-2], True
        elif part.startswith("`"):
            r.text = part[1:-1]
            r.font.name = MONO_FONT
            r.font.color.rgb = rgb("B4235A")
        elif part.startswith("*"):
            r.text, r.italic = part[1:-1], True
        else:
            r.text = part
        r.font.size = Pt(size)
        if not part.startswith("`"):
            r.font.color.rgb = color
        if bold:
            r.bold = True


class Report:
    def __init__(self, meta: dict, base: Path):
        self.meta, self.base = meta, base
        self.brand = meta.get("brand", "#6D4AFF")
        self.doc = Document()
        sec = self.doc.sections[0]
        sec.page_width, sec.page_height = Inches(8.27), Inches(11.69)  # A4
        for side in ("left_margin", "right_margin"):
            setattr(sec, side, Inches(0.9))
        sec.top_margin, sec.bottom_margin = Inches(0.85), Inches(0.8)
        st = self.doc.styles["Normal"]
        st.font.name, st.font.size = BODY_FONT, Pt(10.5)
        st.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
        st.paragraph_format.space_after = Pt(6)
        st.paragraph_format.line_spacing = 1.2
        for lvl, size in ((1, 17), (2, 13.5), (3, 11.5)):
            hs = self.doc.styles[f"Heading {lvl}"]
            hs.font.name, hs.font.size, hs.font.bold = HEAD_FONT, Pt(size), False
            hs.font.color.rgb = rgb(self.brand) if lvl == 1 else TEXT
            hs.element.rPr.rFonts.set(qn("w:ascii"), HEAD_FONT)
            hs.element.rPr.rFonts.set(qn("w:hAnsi"), HEAD_FONT)
            hs.paragraph_format.space_before = Pt(16 if lvl == 1 else 10)
            hs.paragraph_format.space_after = Pt(6 if lvl == 1 else 4)
            hs.paragraph_format.keep_with_next = True
        self.h1_count = 0

    # ---------------------------------------------------------------- cover
    def cover(self):
        m, d = self.meta, self.doc
        for _ in range(5):
            d.add_paragraph()
        p = d.add_paragraph()
        r = p.add_run((m.get("event") or "").upper())
        r.font.name, r.font.size, r.font.color.rgb = MONO_FONT, Pt(10), rgb(self.brand)
        r.font.bold = True
        p = d.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(m.get("title", "Project Report"))
        r.font.name, r.font.size, r.font.color.rgb = HEAD_FONT, Pt(36), TEXT
        if m.get("subtitle"):
            p = d.add_paragraph()
            r = p.add_run(m["subtitle"])
            r.font.size, r.font.color.rgb = Pt(15), MUTED
        bar = d.add_paragraph()
        para_border(bar, self.brand, "bottom", 18)
        bar.paragraph_format.space_after = Pt(18)
        for _ in range(9):
            d.add_paragraph()
        info = [("Team", m.get("team", "")), ("Members", m.get("members", "")), ("Date", m.get("date", date.today().strftime("%d %B %Y")))]
        t = d.add_table(rows=len(info), cols=2)
        for i, (k, v) in enumerate(info):
            c0, c1 = t.cell(i, 0), t.cell(i, 1)
            c0.width, c1.width = Inches(1.4), Inches(5)
            add_inline(c0.paragraphs[0], k.upper(), 9, MUTED, bold=True)
            add_inline(c1.paragraphs[0], v, 12, TEXT, bold=(k == "Team"))
        d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    def header_footer(self):
        sec = self.doc.sections[0]
        sec.different_first_page_header_footer = True
        hp = sec.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        add_inline(hp, f"{self.meta.get('team', '')}  ·  {self.meta.get('title', '')}", 8.5, MUTED)
        fp = sec.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = fp.add_run()
        r.font.size, r.font.color.rgb = Pt(9), MUTED
        add_field(r, "PAGE")

    # ---------------------------------------------------------------- blocks
    def heading(self, text: str, level: int):
        if level == 1:
            self.h1_count += 1
            text = f"{self.h1_count}. {text}" if not re.match(r"^\d", text) else text
        h = self.doc.add_heading(level=level)
        add_inline(h, text, {1: 17, 2: 13.5, 3: 11.5}[level], rgb(self.brand) if level == 1 else TEXT)
        for r in h.runs:
            r.font.name = HEAD_FONT

    def paragraph(self, text: str):
        add_inline(self.doc.add_paragraph(), text)

    def bullet(self, text: str, numbered=False):
        p = self.doc.add_paragraph(style="List Number" if numbered else "List Bullet")
        p.paragraph_format.space_after = Pt(3)
        add_inline(p, text)

    def callout(self, text: str):
        p = self.doc.add_paragraph()
        shade(p._p, "F1EEFF")
        para_border(p, self.brand, "left", 24)
        p.paragraph_format.left_indent = Inches(0.1)
        p.paragraph_format.space_before, p.paragraph_format.space_after = Pt(6), Pt(10)
        add_inline(p, text, 10.5, TEXT)

    def code(self, lines: list[str]):
        p = self.doc.add_paragraph()
        shade(p._p, "F4F5F9")
        p.paragraph_format.left_indent = Inches(0.1)
        r = p.add_run("\n".join(lines))
        r.font.name, r.font.size, r.font.color.rgb = MONO_FONT, Pt(8.5), TEXT

    def table(self, rows: list[list[str]]):
        head, body = rows[0], rows[1:]
        t = self.doc.add_table(rows=1 + len(body), cols=len(head))
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        t.style = self.doc.styles["Table Grid"]
        for i, row in enumerate([head] + body):
            for j in range(len(head)):
                cell = t.cell(i, j)
                val = row[j] if j < len(row) else ""
                cell.paragraphs[0].paragraph_format.space_after = Pt(0)
                add_inline(cell.paragraphs[0], val, 9.5, rgb("FFFFFF") if i == 0 else TEXT, bold=(i == 0))
                if i == 0:
                    shade(cell._tc, self.brand)
                elif i % 2 == 0:
                    shade(cell._tc, "F6F7FB")
        # light borders
        tblPr = t._tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
            b = OxmlElement(f"w:{side}")
            b.set(qn("w:val"), "single"); b.set(qn("w:sz"), "4"); b.set(qn("w:color"), "DDE0EA")
            borders.append(b)
        insert_ordered(tblPr, borders, _TBLPR_AFTER_BORDERS)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)

    def image(self, path: str, caption: str, width: float):
        f = (self.base / path) if not Path(path).is_absolute() else Path(path)
        if not f.is_file():
            self.callout(f"[Missing image: {path}]")
            return
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.keep_with_next = True
        p.add_run().add_picture(str(f), width=Inches(min(width, 6.4)))
        if caption:
            c = self.doc.add_paragraph()
            c.alignment = WD_ALIGN_PARAGRAPH.CENTER
            add_inline(c, caption, 9, MUTED)
            for r in c.runs:
                r.italic = True

    def pagebreak(self):
        self.doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def parse_meta(lines: list[str]) -> tuple[dict, list[str]]:
    meta: dict = {}
    if lines and lines[0].strip() == "---":
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
        for ln in lines[1:end]:
            if ":" in ln:
                k, v = ln.split(":", 1)
                meta[k.strip()] = v.strip()
        lines = lines[end + 1:]
    return meta, lines


def build(md_path: Path, out: Path):
    lines = md_path.read_text(encoding="utf-8-sig").splitlines()  # -sig: tolerate a BOM
    meta, lines = parse_meta(lines)
    rep = Report(meta, md_path.parent)
    rep.cover()
    rep.header_footer()
    i = 0
    while i < len(lines):
        ln = lines[i].rstrip()
        s = ln.strip()
        if not s:
            i += 1; continue
        if s == "[pagebreak]":
            rep.pagebreak()
        elif s.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i]); i += 1
            rep.code(code)
        elif s.startswith("#"):
            level = min(3, len(s) - len(s.lstrip("#")))
            rep.heading(s.lstrip("#").strip(), level)
        elif s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            rep.table(rows)
            continue
        elif m := re.match(r"!\[(.*?)\]\((.*?)\)(\{width=([\d.]+)\})?", s):
            rep.image(m.group(2), m.group(1), float(m.group(4) or 6))
        elif s.startswith(">"):
            rep.callout(s.lstrip(">").strip())
        elif re.match(r"^[-*] ", s):
            rep.bullet(s[2:].strip())
        elif re.match(r"^\d+[.)] ", s):
            rep.bullet(re.sub(r"^\d+[.)] ", "", s), numbered=True)
        else:
            # join soft-wrapped paragraph lines
            buf = [s]
            while i + 1 < len(lines) and lines[i + 1].strip() and not re.match(r"^(#|[-*] |\d+[.)] |>|\||!\[|```|\[pagebreak\])", lines[i + 1].strip()):
                i += 1
                buf.append(lines[i].strip())
            rep.paragraph(" ".join(buf))
        i += 1
    out.parent.mkdir(parents=True, exist_ok=True)
    target, v = out, 2
    while True:
        try:
            rep.doc.save(target)
            break
        except PermissionError:  # open in Word -> save a new version instead
            target = out.with_name(f"{out.stem}_v{v}{out.suffix}")
            v += 1
    if target != out:
        print(f"NOTE: {out.name} is open in Word, saved as {target.name} instead")
    print(f"OK  {target}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    build(Path(sys.argv[1]), Path(sys.argv[2]))
