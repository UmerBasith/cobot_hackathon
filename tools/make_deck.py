r"""
make_deck.py - build an animated, designed PowerPoint from a JSON file.

    .venv\Scripts\python tools\make_deck.py round1\deck\deck.json round1\deck\Ctrl.Alt.Elite_Round1.pptx

Every slide gets: Morph transition (glowing orbs glide between slides), and
entrance animations that play by themselves (title fades, items rise in one by one).
Speaker notes ("notes") are added to each slide for the presenter.

See tools/deck_example.json for every slide type. Slide types:
  title      title, highlight, subtitle, tag
  statement  text, highlight, sub                      (one big sentence; great for the problem hook)
  cards      title, eyebrow, intro, cards:[{icon,title,text}]  (2-4 cards)
  bullets    title, eyebrow, bullets:[str] (max 6), side:{value,label}?  (optional big number on the right)
  flow       title, eyebrow, steps:[{title,text}] (3-6) (architecture / how it works)
  stats      title, eyebrow, stats:[{value,label}] (2-4), note
  image      title, eyebrow, image (path), caption, points:[str] (0-4)
  compare    title, eyebrow, left:{title,items}, right:{title,items}  (before vs after)
  table      title, eyebrow, columns:[str], rows:[[str]], highlight_col (index, optional)
  timeline   title, eyebrow, phases:[{title,text}] (3-5)
  closing    title, highlight, sub, contact
Any slide may have "notes" (speaker script).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

sys.path.insert(0, str(Path(__file__).parent))
from deck_anim import add_animations, set_transition  # noqa: E402

W, H = 13.333, 7.5
FONT_HEAD = "Segoe UI Semibold"
FONT_BODY = "Segoe UI"
FONT_NUM = "Bahnschrift SemiBold"
FONT_MONO = "Consolas"
FONT_EMOJI = "Segoe UI Emoji"

THEMES = {
    "dark": {"bg": "0A0E1A", "card": "121829", "border": "252D48", "text": "F3F5FB", "muted": "9AA3BD", "faint": "1A2136"},
    "light": {"bg": "F7F8FC", "card": "FFFFFF", "border": "E2E5F0", "text": "12152B", "muted": "5B6280", "faint": "EEF0F7"},
}


def hex2rgb(h: str) -> RGBColor:
    return RGBColor.from_string(h.lstrip("#").upper())


class Deck:
    def __init__(self, meta: dict):
        self.meta = meta
        self.t = THEMES.get(meta.get("theme", "dark"), THEMES["dark"])
        self.brand = meta.get("brand", "#7C5CFF").lstrip("#")
        self.accent = meta.get("accent", "#22D3EE").lstrip("#")
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = Inches(W), Inches(H)
        self.blank = self.prs.slide_layouts[6]
        self.n = 0
        self.total = 0

    # ------------------------------------------------------------ primitives
    def text(self, slide, x, y, w, h, text, size=16, color=None, font=FONT_BODY, bold=False,
             align="l", anchor="t", spacing=None, highlight=None, line=1.1):
        tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
        lines = text.split("\n") if isinstance(text, str) else text
        for i, ln in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[align]
            p.line_spacing = line
            parts = [(ln, False)]
            if highlight and highlight in ln:
                a, b = ln.split(highlight, 1)
                parts = [(a, False), (highlight, True), (b, False)]
            for seg, hl in parts:
                if not seg:
                    continue
                r = p.add_run()
                r.text = seg
                f = r.font
                f.size, f.name, f.bold = Pt(size), font, bold
                f.color.rgb = hex2rgb(color or self.t["text"])
                if spacing is not None:
                    r._r.get_or_add_rPr().set("spc", str(int(spacing * 100)))
                if hl:
                    self._grad_text(r)
        return tb

    def _grad_text(self, run):
        rPr = run._r.get_or_add_rPr()
        for el in rPr.findall(qn("a:solidFill")):
            rPr.remove(el)
        grad = etree.SubElement(rPr, qn("a:gradFill"))
        gs = etree.SubElement(grad, qn("a:gsLst"))
        for pos, col in ((0, self.brand), (100000, self.accent)):
            g = etree.SubElement(gs, qn("a:gs"), pos=str(pos))
            etree.SubElement(g, qn("a:srgbClr"), val=col.upper())
        etree.SubElement(grad, qn("a:lin"), ang="0", scaled="0")
        # gradFill must come before latin font element
        latin = rPr.find(qn("a:latin"))
        if latin is not None:
            rPr.remove(grad)
            latin.addprevious(grad)

    def rect(self, slide, x, y, w, h, fill=None, border=None, radius=0.08, shape=MSO_SHAPE.ROUNDED_RECTANGLE, alpha=None, line_w=0.75):
        s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
        if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
            s.adjustments[0] = radius
        if fill:
            s.fill.solid()
            s.fill.fore_color.rgb = hex2rgb(fill)
            if alpha is not None:
                clr = s.fill._xPr.find(qn("a:solidFill"))[0]
                etree.SubElement(clr, qn("a:alpha"), val=str(int(alpha * 1000)))
        else:
            s.fill.background()
        if border:
            s.line.color.rgb = hex2rgb(border)
            s.line.width = Pt(line_w)
        else:
            s.line.fill.background()
        s.shadow.inherit = False
        s.text_frame.text = ""
        return s

    def grad_fill(self, shape, c1, c2, angle=45):
        spPr = shape.fill._xPr
        for tag in ("a:solidFill", "a:noFill", "a:gradFill"):
            for el in spPr.findall(qn(tag)):
                spPr.remove(el)
        grad = etree.Element(qn("a:gradFill"), rotWithShape="1")
        gs = etree.SubElement(grad, qn("a:gsLst"))
        for pos, col in ((0, c1), (100000, c2)):
            g = etree.SubElement(gs, qn("a:gs"), pos=str(pos))
            etree.SubElement(g, qn("a:srgbClr"), val=col.upper())
        etree.SubElement(grad, qn("a:lin"), ang=str(angle * 60000), scaled="0")
        prst = spPr.find(qn("a:prstGeom"))
        prst.addnext(grad)

    def orb(self, slide, name, cx, cy, d, color, alpha=40):
        """Soft glowing circle. Same name on every slide -> Morph glides it."""
        s = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(cx - d / 2), Inches(cy - d / 2), Inches(d), Inches(d))
        s.name = name
        s.fill.solid()
        s.fill.fore_color.rgb = hex2rgb(color)
        clr = s.fill._xPr.find(qn("a:solidFill"))[0]
        etree.SubElement(clr, qn("a:alpha"), val=str(alpha * 1000))
        s.line.fill.background()
        spPr = s.fill._xPr
        eff = etree.SubElement(spPr, qn("a:effectLst"))
        etree.SubElement(eff, qn("a:softEdge"), rad=str(int(Inches(d * 0.38))))
        return s

    def group(self, slide):
        return slide.shapes.add_group_shape()

    # --------------------------------------------------------------- chrome
    def new_slide(self, eyebrow: str | None = None, title: str | None = None, highlight: str | None = None, title_size=34):
        self.n += 1
        s = self.prs.slides.add_slide(self.blank)
        bg = s.background.fill
        bg.solid()
        bg.fore_color.rgb = hex2rgb(self.t["bg"])
        # glowing orbs that move between slides (positions vary per slide)
        k = self.n
        self.orb(s, "!!orbA", 11.2 - 3.5 * math.sin(k * 1.3), 0.6 + 1.2 * math.cos(k * 0.9), 5.2, self.brand, 48)
        self.orb(s, "!!orbB", 1.5 + 2.8 * math.cos(k * 1.1), 6.9 - 1.0 * math.sin(k * 1.7), 4.4, self.accent, 34)
        # thin top accent line
        line = self.rect(s, 0, 0, W, 0.06, fill=self.brand, shape=MSO_SHAPE.RECTANGLE)
        self.grad_fill(line, self.brand, self.accent, 0)
        line.name = "!!topline"
        anims: list[tuple[int, str, int, int]] = []
        if eyebrow:
            e = self.text(s, 0.75, 0.55, 8, 0.35, f"{self.n:02d}  ·  {eyebrow.upper()}", 12, self.accent, FONT_MONO, spacing=2)
            anims.append((e.shape_id, "fade", 0, 500))
        if title:
            size = title_size if len(title) <= 38 else title_size - 6 if len(title) <= 60 else title_size - 10
            tt = self.text(s, 0.75, 0.9, 11.8, 1.1, title, size, None, FONT_HEAD, highlight=highlight)
            anims.append((tt.shape_id, "rise", 100, 700))
        # footer
        team = self.meta.get("team", "")
        self.text(s, 0.75, 6.98, 6, 0.3, f"{team}  ·  {self.meta.get('event', '')}", 10, self.t["muted"], FONT_BODY)
        self.text(s, W - 1.75, 6.98, 1.0, 0.3, f"{self.n:02d}", 10, self.t["muted"], FONT_MONO, align="r")
        return s, anims

    def finish(self, slide, anims, notes=None, transition="morph"):
        set_transition(slide, transition)
        add_animations(slide, anims)
        if notes:
            slide.notes_slide.notes_text_frame.text = notes

    def badge(self, slide_or_group, x, y, d, label, emoji=False, size=None):
        c = slide_or_group.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
        c.fill.solid()
        c.fill.fore_color.rgb = hex2rgb(self.brand)
        self.grad_fill(c, self.brand, self.accent, 45)
        c.line.fill.background()
        c.shadow.inherit = False
        tf = c.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = str(label)
        r.font.size = Pt(size or (d * 30 if emoji else d * 26))
        r.font.bold = not emoji
        r.font.name = FONT_EMOJI if emoji else FONT_NUM
        r.font.color.rgb = hex2rgb("FFFFFF")
        return c

    def card(self, parent, x, y, w, h):
        return self.rect(parent, x, y, w, h, fill=self.t["card"], border=self.t["border"], radius=0.07)

    # ------------------------------------------------------------- layouts
    def s_title(self, d):
        s, anims = self.new_slide()
        tag = d.get("tag") or self.meta.get("event", "")
        if tag:
            pill = self.rect(s, 0.75, 1.55, 0.3 + len(tag) * 0.105, 0.42, fill=self.t["faint"], border=self.t["border"], radius=0.5)
            t = self.text(s, 0.9, 1.6, len(tag) * 0.105 + 0.1, 0.32, tag, 12, self.accent, FONT_MONO, anchor="m")
            anims += [(pill.shape_id, "fade", 0, 500), (t.shape_id, "fade", 0, 500)]
        title = d["title"]
        size = 60 if len(title) <= 28 else 50 if len(title) <= 45 else 42
        tt = self.text(s, 0.75, 2.2, 11.5, 2.4, title, size, None, FONT_HEAD, highlight=d.get("highlight"), line=1.0)
        anims.append((tt.shape_id, "rise", 150, 900))
        if d.get("subtitle"):
            st = self.text(s, 0.75, 4.55, 9.5, 1.0, d["subtitle"], 20, self.t["muted"])
            anims.append((st.shape_id, "rise", 450, 800))
        bar = self.rect(s, 0.75, 5.75, 0.08, 0.75, fill=self.brand, shape=MSO_SHAPE.RECTANGLE)
        self.grad_fill(bar, self.brand, self.accent, 90)
        team = self.text(s, 1.0, 5.72, 8, 0.4, self.meta.get("team", ""), 20, None, FONT_HEAD)
        mem = self.text(s, 1.0, 6.12, 9, 0.4, "  ·  ".join(self.meta.get("members", [])), 14, self.t["muted"])
        anims += [(bar.shape_id, "wipe", 700, 400), (team.shape_id, "left", 750, 600), (mem.shape_id, "left", 850, 600)]
        self.finish(s, anims, d.get("notes"))

    def s_statement(self, d):
        s, anims = self.new_slide(d.get("eyebrow", "The problem"))
        txt = d["text"]
        size = 44 if len(txt) <= 70 else 36 if len(txt) <= 120 else 30
        tt = self.text(s, 0.75, 1.9, 11.8, 3.0, txt, size, None, FONT_HEAD, highlight=d.get("highlight"), line=1.05, anchor="m")
        anims.append((tt.shape_id, "rise", 150, 900))
        if d.get("sub"):
            st = self.text(s, 0.75, 5.1, 11, 1.2, d["sub"], 18, self.t["muted"])
            anims.append((st.shape_id, "rise", 600, 700))
        self.finish(s, anims, d.get("notes"))

    def s_cards(self, d):
        s, anims = self.new_slide(d.get("eyebrow"), d["title"], d.get("highlight"))
        y0 = 2.15
        if d.get("intro"):
            it = self.text(s, 0.75, 1.95, 11.5, 0.6, d["intro"], 16, self.t["muted"])
            anims.append((it.shape_id, "fade", 250, 600))
            y0 = 2.75
        cards = d["cards"][:4]
        n = len(cards)
        gap = 0.3
        cw = (W - 1.5 - gap * (n - 1)) / n
        longest = max(len(c.get("text", "")) for c in cards)
        chars_per_line = max(16, (cw - 0.7) * 11)
        ch = min(6.65 - y0, 2.45 + 0.3 * math.ceil(longest / chars_per_line))
        for i, c in enumerate(cards):
            x = 0.75 + i * (cw + gap)
            g = self.group(s)
            self.card(g, x, y0, cw, ch)
            icon = c.get("icon")
            self.badge(g, x + 0.35, y0 + 0.35, 0.7, icon or i + 1, emoji=bool(icon))
            ts = 20 if cw > 3.5 else 18
            self.text(g, x + 0.35, y0 + 1.25, cw - 0.7, 0.6, c["title"], ts, None, FONT_HEAD)
            self.text(g, x + 0.35, y0 + 1.85, cw - 0.7, ch - 2.0, c.get("text", ""), 14 if cw > 3.5 else 13, self.t["muted"], line=1.2)
            anims.append((g.shape_id, "rise", 350 + i * 180, 700))
        self.finish(s, anims, d.get("notes"))

    def s_bullets(self, d):
        s, anims = self.new_slide(d.get("eyebrow"), d["title"], d.get("highlight"))
        side = d.get("side")
        width = 7.6 if side else 11.5
        bullets = d["bullets"][:6]
        step = min(0.78, 4.4 / max(1, len(bullets)))
        for i, b in enumerate(bullets):
            y = 2.25 + i * step
            g = self.group(s)
            dot = self.rect(g, 0.8, y + 0.1, 0.16, 0.16, fill=self.brand, shape=MSO_SHAPE.OVAL)
            self.grad_fill(dot, self.brand, self.accent)
            self.text(g, 1.2, y, width - 0.5, step, b, 18 if len(b) < 90 else 16, None, line=1.15)
            anims.append((g.shape_id, "left", 300 + i * 150, 600))
        if side:
            g = self.group(s)
            self.card(g, 8.9, 2.2, 3.7, 3.9)
            self.text(g, 9.1, 2.6, 3.3, 1.6, str(side["value"]), 66, self.brand, FONT_NUM, align="c", highlight=str(side["value"]))
            self.text(g, 9.1, 4.3, 3.3, 1.5, side.get("label", ""), 15, self.t["muted"], align="c")
            anims.append((g.shape_id, "zoom", 500 + len(bullets) * 150, 700))
        self.finish(s, anims, d.get("notes"))

    def s_flow(self, d):
        s, anims = self.new_slide(d.get("eyebrow", "How it works"), d["title"], d.get("highlight"))
        steps = d["steps"][:6]
        n = len(steps)
        arrow_w = 0.45
        bw = (W - 1.5 - arrow_w * (n - 1) - 0.12 * 2 * (n - 1)) / n
        longest = max(len(st.get("text", "")) for st in steps)
        bh = min(4.1, 2.25 + 0.3 * math.ceil(longest / max(14, bw * 8)))
        y = 2.2 + (4.4 - bh) / 2
        t = 300
        for i, st in enumerate(steps):
            x = 0.75 + i * (bw + arrow_w + 0.24)
            g = self.group(s)
            self.card(g, x, y, bw, bh)
            self.badge(g, x + bw / 2 - 0.32, y + 0.3, 0.64, i + 1)
            self.text(g, x + 0.2, y + 1.15, bw - 0.4, 0.8, st["title"], 17 if bw > 2 else 15, None, FONT_HEAD, align="c")
            self.text(g, x + 0.2, y + 1.85, bw - 0.4, bh - 2.0, st.get("text", ""), 12.5 if bw > 2 else 11.5, self.t["muted"], align="c", line=1.15)
            anims.append((g.shape_id, "rise", t, 600))
            t += 220
            if i < n - 1:
                a = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + bw + 0.12), Inches(y + bh / 2 - 0.2), Inches(arrow_w), Inches(0.4))
                a.fill.solid()
                a.fill.fore_color.rgb = hex2rgb(self.accent)
                a.line.fill.background()
                a.shadow.inherit = False
                anims.append((a.shape_id, "wipe", t - 60, 300))
        self.finish(s, anims, d.get("notes"))

    def s_stats(self, d):
        s, anims = self.new_slide(d.get("eyebrow", "Impact"), d["title"], d.get("highlight"))
        stats = d["stats"][:4]
        n = len(stats)
        gap = 0.3
        cw = (W - 1.5 - gap * (n - 1)) / n
        for i, st in enumerate(stats):
            x = 0.75 + i * (cw + gap)
            g = self.group(s)
            self.card(g, x, 2.4, cw, 3.2)
            v = str(st["value"])
            size = 60 if len(v) <= 4 else 48 if len(v) <= 6 else 38
            self.text(g, x + 0.2, 2.75, cw - 0.4, 1.4, v, size, self.brand, FONT_NUM, align="c", anchor="m", highlight=v)
            self.text(g, x + 0.3, 4.25, cw - 0.6, 1.2, st.get("label", ""), 15, self.t["muted"], align="c", line=1.15)
            anims.append((g.shape_id, "zoom", 300 + i * 180, 650))
        if d.get("note"):
            nt = self.text(s, 0.75, 5.95, 11.8, 0.6, d["note"], 13, self.t["muted"], align="c")
            anims.append((nt.shape_id, "fade", 400 + n * 180, 600))
        self.finish(s, anims, d.get("notes"))

    def s_image(self, d):
        s, anims = self.new_slide(d.get("eyebrow", "Live demo"), d["title"], d.get("highlight"))
        pts = d.get("points", [])[:4]
        iw = 8.2 if pts else 11.8
        ix, iy, ih_max = 0.75, 2.05, 4.55
        img = Path(d.get("image", ""))
        if img.is_file():
            from PIL import Image
            with Image.open(img) as im:
                ar = im.height / im.width
            w, h = iw, iw * ar
            if h > ih_max:
                h, w = ih_max, ih_max / ar
            frame = self.rect(s, ix - 0.06, iy - 0.06, w + 0.12, h + 0.12, fill=self.t["card"], border=self.t["border"], radius=0.03)
            pic = s.shapes.add_picture(str(img), Inches(ix), Inches(iy), Inches(w), Inches(h))
            anims += [(frame.shape_id, "rise", 250, 700), (pic.shape_id, "rise", 250, 700)]
        else:
            ph = self.card(s, ix, iy, iw, ih_max)
            self.text(s, ix, iy + ih_max / 2 - 0.3, iw, 0.6, f"[ screenshot missing: {img.name or 'set image path'} ]", 14, self.t["muted"], FONT_MONO, align="c")
            anims.append((ph.shape_id, "fade", 250, 600))
        if d.get("caption"):
            cap = self.text(s, ix, 6.68, iw, 0.3, d["caption"], 11, self.t["muted"], FONT_MONO)
            anims.append((cap.shape_id, "fade", 600, 500))
        for i, p in enumerate(pts):
            g = self.group(s)
            y = 2.1 + i * 1.12
            self.card(g, 9.3, y, 3.3, 0.98)
            self.badge(g, 9.45, y + 0.22, 0.52, i + 1)
            self.text(g, 10.1, y + 0.1, 2.4, 0.8, p, 12.5, None, anchor="m", line=1.1)
            anims.append((g.shape_id, "left", 600 + i * 170, 550))
        self.finish(s, anims, d.get("notes"))

    def s_compare(self, d):
        s, anims = self.new_slide(d.get("eyebrow", "Why it's better"), d["title"], d.get("highlight"))
        for col, (key, good) in enumerate((("left", False), ("right", True))):
            side = d[key]
            x = 0.75 + col * 6.05
            g = self.group(s)
            box = self.rect(g, x, 2.15, 5.85, 4.5, fill=self.t["card"], border=self.brand if good else self.t["border"], radius=0.06, line_w=1.5 if good else 0.75)
            _ = box
            self.text(g, x + 0.4, 2.4, 5, 0.6, side["title"], 20, self.brand if good else self.t["muted"], FONT_HEAD)
            for i, it in enumerate(side["items"][:5]):
                yy = 3.15 + i * 0.68
                mark = "✓" if good else "✕"
                self.text(g, x + 0.4, yy, 0.4, 0.5, mark, 16, "10B981" if good else "EF4444", FONT_HEAD)
                self.text(g, x + 0.85, yy, 4.7, 0.6, it, 15, None if good else self.t["muted"], line=1.1)
            anims.append((g.shape_id, "rise", 300 + col * 350, 700))
        self.finish(s, anims, d.get("notes"))

    def s_table(self, d):
        s, anims = self.new_slide(d.get("eyebrow", "Comparison"), d["title"], d.get("highlight"))
        cols, rows = d["columns"], d["rows"]
        hl = d.get("highlight_col")
        nr, nc = len(rows) + 1, len(cols)
        h = min(4.4, 0.62 * nr)
        gf = s.shapes.add_table(nr, nc, Inches(0.75), Inches(2.2), Inches(11.8), Inches(h))
        tbl = gf.table
        tblPr = tbl._tbl.tblPr
        for attr in ("bandRow", "firstRow"):
            tblPr.set(attr, "0")
        style = tblPr.find(qn("a:tableStyleId"))
        if style is not None:
            style.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"  # "No Style, No Grid"
        else:
            etree.SubElement(tblPr, qn("a:tableStyleId")).text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"
        for r in range(nr):
            for c in range(nc):
                cell = tbl.cell(r, c)
                val = cols[c] if r == 0 else str(rows[r - 1][c]) if c < len(rows[r - 1]) else ""
                cell.text = ""
                p = cell.text_frame.paragraphs[0]
                p.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
                run = p.add_run()
                run.text = val
                run.font.size = Pt(14 if r else 13)
                run.font.name = FONT_HEAD if (r == 0 or c == 0) else FONT_BODY
                is_hl = hl is not None and c == hl
                run.font.color.rgb = hex2rgb("FFFFFF" if (r == 0 and is_hl) else self.accent if r == 0 else self.t["text"] if (is_hl or c == 0) else self.t["muted"])
                run.font.bold = bool(is_hl and r > 0)
                cell.vertical_anchor = MSO_ANCHOR.MIDDLE
                cell.margin_left = cell.margin_right = Inches(0.15)
                cell.fill.solid()
                cell.fill.fore_color.rgb = hex2rgb(self.brand if (r == 0 and is_hl) else self.t["faint"] if r == 0 else self.t["card"])
        anims.append((gf.shape_id, "rise", 300, 800))
        self.finish(s, anims, d.get("notes"))

    def s_timeline(self, d):
        s, anims = self.new_slide(d.get("eyebrow", "Roadmap"), d["title"], d.get("highlight"))
        phases = d["phases"][:5]
        n = len(phases)
        line = self.rect(s, 0.95, 3.4, W - 1.9, 0.05, fill=self.brand, shape=MSO_SHAPE.RECTANGLE)
        self.grad_fill(line, self.brand, self.accent, 0)
        anims.append((line.shape_id, "wipe", 250, 900))
        seg = (W - 1.9) / n
        for i, ph in enumerate(phases):
            cx = 0.95 + seg * i + seg / 2
            g = self.group(s)
            self.badge(g, cx - 0.3, 3.12, 0.6, i + 1)
            self.text(g, cx - seg / 2 + 0.15, 4.0, seg - 0.3, 0.6, ph["title"], 17, None, FONT_HEAD, align="c")
            self.text(g, cx - seg / 2 + 0.15, 4.6, seg - 0.3, 2.0, ph.get("text", ""), 13, self.t["muted"], align="c", line=1.15)
            anims.append((g.shape_id, "rise", 500 + i * 220, 600))
        self.finish(s, anims, d.get("notes"))

    def s_closing(self, d):
        s, anims = self.new_slide()
        tt = self.text(s, 0.75, 1.8, 11.8, 1.8, d.get("title", "Thank you"), 72, None, FONT_HEAD, align="c", highlight=d.get("highlight"), anchor="m")
        anims.append((tt.shape_id, "zoom", 150, 900))
        if d.get("sub"):
            st = self.text(s, 1.5, 3.75, 10.3, 0.9, d["sub"], 20, self.t["muted"], align="c")
            anims.append((st.shape_id, "rise", 600, 700))
        team = self.text(s, 0.75, 5.0, 11.8, 0.5, self.meta.get("team", ""), 24, None, FONT_HEAD, align="c", highlight=self.meta.get("team", ""))
        mem = self.text(s, 0.75, 5.5, 11.8, 0.4, "  ·  ".join(self.meta.get("members", [])), 15, self.t["muted"], align="c")
        anims += [(team.shape_id, "rise", 900, 600), (mem.shape_id, "rise", 1000, 600)]
        if d.get("contact"):
            c = self.text(s, 0.75, 6.0, 11.8, 0.4, d["contact"], 13, self.accent, FONT_MONO, align="c")
            anims.append((c.shape_id, "fade", 1200, 500))
        self.finish(s, anims, d.get("notes"))

    def build(self, slides: list[dict], out: Path):
        self.total = len(slides)
        for d in slides:
            fn = getattr(self, f"s_{d['type']}", None)
            if fn is None:
                raise SystemExit(f"Unknown slide type: {d['type']}")
            fn(d)
        out.parent.mkdir(parents=True, exist_ok=True)
        target, v = out, 2
        while True:
            try:
                self.prs.save(target)
                break
            except PermissionError:  # file is open in PowerPoint -> save a new version instead
                target = out.with_name(f"{out.stem}_v{v}{out.suffix}")
                v += 1
        if target != out:
            print(f"NOTE: {out.name} is open in PowerPoint, saved as {target.name} instead")
        return target


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    spec = json.loads(src.read_text(encoding="utf-8-sig"))
    base = src.parent
    for sl in spec["slides"]:  # image paths are relative to the json file
        if sl.get("image") and not Path(sl["image"]).is_absolute():
            sl["image"] = str((base / sl["image"]).resolve())
    deck = Deck(spec.get("meta", {}))
    saved = deck.build(spec["slides"], out)
    print(f"OK  {saved}  ({len(spec['slides'])} slides)")


if __name__ == "__main__":
    main()
